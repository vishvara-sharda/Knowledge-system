import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Connection as FlowConnection,
  type Edge,
  type Node,
  type Viewport,
  ReactFlowProvider,
  useReactFlow,
  MarkerType,
} from '@xyflow/react';
import { Plus, Sparkles, Loader2 } from 'lucide-react';

import type {
  Workspace,
  KnowledgeNode,
  Connection,
  Tag,
  SaveStatus,
} from './types';
import { api } from './services/api';
import { KnowledgeNodeComponent } from './components/KnowledgeNodeComponent';
import type { KnowledgeNodeData } from './components/KnowledgeNodeComponent';
import { Sidebar } from './components/Sidebar';
import { DetailPanel } from './components/DetailPanel';
import { CanvasHeader } from './components/CanvasHeader';
import { ContextMenu } from './components/ContextMenu';
import type { ContextMenuState } from './components/ContextMenu';
import { ConfirmModal } from './components/ConfirmModal';

const nodeTypes = {
  knowledgeNode: KnowledgeNodeComponent,
};

// Inner canvas component where useReactFlow() is valid
const CanvasFlow: React.FC = () => {
  const reactFlow = useReactFlow();

  // State
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [knowledgeNodes, setKnowledgeNodes] = useState<KnowledgeNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [isLoading, setIsLoading] = useState(true);

  // Settings
  const [showMinimap, setShowMinimap] = useState(true);
  const [gridType, setGridType] = useState<'dots' | 'lines' | 'cross'>('dots');
  const [snapToGrid, setSnapToGrid] = useState(false);

  // Context menu & modal states
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [deleteModalNodeId, setDeleteModalNodeId] = useState<string | null>(null);

  // Undo/Redo history stack
  const [history, setHistory] = useState<{ nodes: KnowledgeNode[]; connections: Connection[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoAction = useRef(false);

  // Debounce refs for position saving
  const pendingPositionUpdates = useRef<Map<string, { x: number; y: number }>>(new Map());
  const positionSaveTimer = useRef<number | null>(null);
  const viewportSaveTimer = useRef<number | null>(null);

  // 1. Load Workspaces on mount
  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);
        const wsList = await api.getWorkspaces();
        setWorkspaces(wsList);
        if (wsList.length > 0) {
          setActiveWorkspace(wsList[0]);
        }
      } catch (err) {
        console.error('Failed to load workspaces:', err);
        setSaveStatus('error');
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // 2. Load Workspace Graph when active workspace changes
  const loadWorkspaceGraph = useCallback(async (workspaceId: string) => {
    try {
      setIsLoading(true);
      const graph = await api.getWorkspaceGraph(workspaceId);
      setKnowledgeNodes(graph.nodes);
      setConnections(graph.connections);
      setTags(graph.tags);
      setSelectedNodeId(null);
      setHistory([{ nodes: graph.nodes, connections: graph.connections }]);
      setHistoryIndex(0);

      // Ensure nodes are immediately visible and centered
      if (graph.nodes && graph.nodes.length > 0) {
        setTimeout(() => {
          reactFlow.fitView({ padding: 0.25, duration: 400 });
        }, 150);
      } else if (graph.viewport) {
        setTimeout(() => {
          reactFlow.setViewport({
            x: graph.viewport.viewport_x || 0,
            y: graph.viewport.viewport_y || 0,
            zoom: graph.viewport.zoom || 1,
          });
        }, 100);
      }
    } catch (err) {
      console.error('Failed to load workspace graph:', err);
      setSaveStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [reactFlow]);

  useEffect(() => {
    if (activeWorkspace) {
      loadWorkspaceGraph(activeWorkspace.id);
    }
  }, [activeWorkspace?.id, loadWorkspaceGraph]);

  // Push state to undo/redo history
  const pushHistory = useCallback((newNodes: KnowledgeNode[], newConns: Connection[]) => {
    if (isUndoRedoAction.current) return;
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, { nodes: newNodes, connections: newConns }];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  // Convert KnowledgeNodes & Connections to React Flow Nodes & Edges
  useEffect(() => {
    const activeNodesList = knowledgeNodes.filter((kn) => !kn.is_deleted);

    const flowNodes: Node[] = activeNodesList.map((kn) => {
      const isSearchMatch = Boolean(
        searchQuery &&
          (kn.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (kn.content && kn.content.toLowerCase().includes(searchQuery.toLowerCase())))
      );

      const nodeData: KnowledgeNodeData = {
        ...kn,
        isSearchMatch,
        onToggleFavorite: (id, isFav) => handleToggleFavorite(id, isFav),
        onDuplicate: (id) => handleDuplicateNode(id),
        onDelete: (id) => setDeleteModalNodeId(id),
        onAddChildNode: (id) => handleAddChildNode(id),
        onSelectNode: (id) => setSelectedNodeId(id),
      };

      return {
        id: kn.id,
        type: 'knowledgeNode',
        position: { x: kn.position_x, y: kn.position_y },
        data: nodeData,
        selected: selectedNodeId === kn.id,
      };
    });

    const flowEdges: Edge[] = connections.map((c) => ({
      id: c.id,
      source: c.source_node_id,
      target: c.target_node_id,
      label: c.relationship || undefined,
      type: 'smoothstep',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#ec4899',
        width: 16,
        height: 16,
      },
      style: { stroke: '#f472b6', strokeWidth: 2.2 },
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [knowledgeNodes, connections, selectedNodeId, searchQuery]);

  // 3. Node Dragging & Batch Debounced Position Autosave
  const handleNodeDrag = useCallback((_event: unknown, node: Node) => {
    pendingPositionUpdates.current.set(node.id, { x: node.position.x, y: node.position.y });
    setSaveStatus('saving');

    if (positionSaveTimer.current) {
      window.clearTimeout(positionSaveTimer.current);
    }

    positionSaveTimer.current = window.setTimeout(async () => {
      if (pendingPositionUpdates.current.size === 0) return;

      const updates: { id: string; position_x: number; position_y: number }[] = [];
      pendingPositionUpdates.current.forEach((pos, id) => {
        updates.push({ id, position_x: Math.round(pos.x), position_y: Math.round(pos.y) });
      });
      pendingPositionUpdates.current.clear();

      try {
        await api.batchUpdateNodePositions(updates);

        // Update local knowledgeNodes coordinates
        setKnowledgeNodes((prev) =>
          prev.map((kn) => {
            const found = updates.find((u) => u.id === kn.id);
            return found ? { ...kn, position_x: found.position_x, position_y: found.position_y } : kn;
          })
        );
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to save node positions:', err);
        setSaveStatus('error');
      }
    }, 600);
  }, []);

  // 4. Viewport Pan/Zoom debounced save
  const handleMoveEnd = useCallback(
    (_event: unknown, viewport: Viewport) => {
      if (!activeWorkspace) return;

      if (viewportSaveTimer.current) {
        window.clearTimeout(viewportSaveTimer.current);
      }

      viewportSaveTimer.current = window.setTimeout(async () => {
        try {
          await api.saveViewport(activeWorkspace.id, {
            viewport_x: viewport.x,
            viewport_y: viewport.y,
            zoom: viewport.zoom,
          });
        } catch (err) {
          console.error('Failed to save viewport:', err);
        }
      }, 1000);
    },
    [activeWorkspace]
  );

  // 5. Connect 2 nodes via drag handle
  const onConnect = useCallback(
    async (params: FlowConnection) => {
      if (!activeWorkspace || !params.source || !params.target) return;
      if (params.source === params.target) return;

      // Check duplicate
      const duplicate = connections.some(
        (c) => c.source_node_id === params.source && c.target_node_id === params.target
      );
      if (duplicate) return;

      setSaveStatus('saving');
      try {
        const newConn = await api.createConnection({
          workspace_id: activeWorkspace.id,
          source_node_id: params.source,
          target_node_id: params.target,
        });

        const nextConns = [...connections, newConn];
        setConnections(nextConns);
        pushHistory(knowledgeNodes, nextConns);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to create connection:', err);
        setSaveStatus('error');
      }
    },
    [activeWorkspace, connections, knowledgeNodes, pushHistory]
  );

  // 6. Create Node
  const handleCreateNode = useCallback(
    async (posX?: number, posY?: number) => {
      if (!activeWorkspace) return;

      // Calculate position in view center if not provided
      let x = posX ?? 250;
      let y = posY ?? 200;

      if (posX === undefined || posY === undefined) {
        // Place near center of current viewport
        const { x: vx, y: vy, zoom } = reactFlow.getViewport();
        x = Math.round((-vx + window.innerWidth / 2) / zoom);
        y = Math.round((-vy + window.innerHeight / 2) / zoom);
      }

      setSaveStatus('saving');
      try {
        const newNode = await api.createNode({
          workspace_id: activeWorkspace.id,
          title: `Node ${knowledgeNodes.length + 1}`,
          content: '',
          position_x: x,
          position_y: y,
          color: '#ec4899',
        });

        const nextNodes = [...knowledgeNodes, newNode];
        setKnowledgeNodes(nextNodes);
        setSelectedNodeId(newNode.id);
        pushHistory(nextNodes, connections);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to create node:', err);
        setSaveStatus('error');
      }
    },
    [activeWorkspace, knowledgeNodes, connections, pushHistory, reactFlow]
  );

  // 7. Add connected child node directly from an existing node
  const handleAddChildNode = useCallback(
    async (sourceNodeId: string) => {
      if (!activeWorkspace) return;
      const sourceNode = knowledgeNodes.find((n) => n.id === sourceNodeId);
      if (!sourceNode) return;

      setSaveStatus('saving');
      try {
        // Position child node to the right and slightly below
        const childPosX = sourceNode.position_x + 320;
        const childPosY = sourceNode.position_y + 40;

        const childNode = await api.createNode({
          workspace_id: activeWorkspace.id,
          title: `Related to ${sourceNode.title}`,
          content: '',
          position_x: childPosX,
          position_y: childPosY,
          color: sourceNode.color && sourceNode.color !== '#1e293b' ? sourceNode.color : '#ec4899',
        });

        const newConn = await api.createConnection({
          workspace_id: activeWorkspace.id,
          source_node_id: sourceNodeId,
          target_node_id: childNode.id,
          relationship: 'relates to',
        });

        const nextNodes = [...knowledgeNodes, childNode];
        const nextConns = [...connections, newConn];
        setKnowledgeNodes(nextNodes);
        setConnections(nextConns);
        setSelectedNodeId(childNode.id);
        pushHistory(nextNodes, nextConns);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to add child node:', err);
        setSaveStatus('error');
      }
    },
    [activeWorkspace, knowledgeNodes, connections, pushHistory]
  );

  // 8. Duplicate Node
  const handleDuplicateNode = useCallback(
    async (nodeId: string) => {
      if (!activeWorkspace) return;
      const original = knowledgeNodes.find((n) => n.id === nodeId);
      if (!original) return;

      setSaveStatus('saving');
      try {
        const copy = await api.createNode({
          workspace_id: activeWorkspace.id,
          title: `${original.title} (Copy)`,
          content: original.content || '',
          position_x: original.position_x + 50,
          position_y: original.position_y + 50,
          color: original.color,
          tags: original.tags,
        });

        const nextNodes = [...knowledgeNodes, copy];
        setKnowledgeNodes(nextNodes);
        setSelectedNodeId(copy.id);
        pushHistory(nextNodes, connections);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to duplicate node:', err);
        setSaveStatus('error');
      }
    },
    [activeWorkspace, knowledgeNodes, connections, pushHistory]
  );

  // 9. Update Node (title, content, tags, color, favorite)
  const handleUpdateNode = useCallback(
    async (id: string, updates: Partial<KnowledgeNode>) => {
      setSaveStatus('saving');
      try {
        const updated = await api.updateNode(id, updates);
        const nextNodes = knowledgeNodes.map((n) => (n.id === id ? { ...n, ...updated } : n));
        setKnowledgeNodes(nextNodes);
        pushHistory(nextNodes, connections);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to update node:', err);
        setSaveStatus('error');
      }
    },
    [knowledgeNodes, connections, pushHistory]
  );

  // 10. Toggle Favorite
  const handleToggleFavorite = useCallback(
    async (id: string, isFav: boolean) => {
      handleUpdateNode(id, { is_favorite: isFav ? 1 : 0 });
    },
    [handleUpdateNode]
  );

  // 11. Delete Node (soft delete or confirmed permanent)
  const handleConfirmDeleteNode = useCallback(async () => {
    if (!deleteModalNodeId) return;
    const nodeId = deleteModalNodeId;
    setDeleteModalNodeId(null);
    setSaveStatus('saving');

    try {
      await api.deleteNode(nodeId);
      const nextNodes = knowledgeNodes.filter((n) => n.id !== nodeId);
      const nextConns = connections.filter((c) => c.source_node_id !== nodeId && c.target_node_id !== nodeId);
      setKnowledgeNodes(nextNodes);
      setConnections(nextConns);
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
      pushHistory(nextNodes, nextConns);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to delete node:', err);
      setSaveStatus('error');
    }
  }, [deleteModalNodeId, knowledgeNodes, connections, selectedNodeId, pushHistory]);

  // 12. Connections: Create & Delete
  const handleCreateConnectionFromPanel = useCallback(
    async (sourceId: string, targetId: string, relationship?: string) => {
      if (!activeWorkspace) return;
      setSaveStatus('saving');
      try {
        const newConn = await api.createConnection({
          workspace_id: activeWorkspace.id,
          source_node_id: sourceId,
          target_node_id: targetId,
          relationship,
        });

        const nextConns = [...connections, newConn];
        setConnections(nextConns);
        pushHistory(knowledgeNodes, nextConns);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to create connection:', err);
        setSaveStatus('error');
      }
    },
    [activeWorkspace, connections, knowledgeNodes, pushHistory]
  );

  const handleDeleteConnection = useCallback(
    async (connectionId: string) => {
      setSaveStatus('saving');
      try {
        await api.deleteConnection(connectionId);
        const nextConns = connections.filter((c) => c.id !== connectionId);
        setConnections(nextConns);
        pushHistory(knowledgeNodes, nextConns);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to delete connection:', err);
        setSaveStatus('error');
      }
    },
    [connections, knowledgeNodes, pushHistory]
  );

  // 13. Jump to Node on Canvas
  const handleJumpToNode = useCallback(
    (nodeId: string) => {
      const node = knowledgeNodes.find((n) => n.id === nodeId);
      if (!node) return;
      setSelectedNodeId(nodeId);
      reactFlow.setCenter(node.position_x + 120, node.position_y + 80, {
        zoom: 1.2,
        duration: 700,
      });
    },
    [knowledgeNodes, reactFlow]
  );

  // 14. Workspace Management: Create & Rename
  const handleCreateWorkspace = useCallback(async (name: string) => {
    setSaveStatus('saving');
    try {
      const created = await api.createWorkspace(name);
      setWorkspaces((prev) => [created, ...prev]);
      setActiveWorkspace(created);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to create workspace:', err);
      setSaveStatus('error');
    }
  }, []);

  const handleRenameWorkspace = useCallback(
    async (newName: string) => {
      if (!activeWorkspace) return;
      setSaveStatus('saving');
      try {
        await api.updateWorkspace(activeWorkspace.id, newName);
        setActiveWorkspace((prev) => (prev ? { ...prev, name: newName } : null));
        setWorkspaces((prev) => prev.map((w) => (w.id === activeWorkspace.id ? { ...w, name: newName } : w)));
        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to rename workspace:', err);
        setSaveStatus('error');
      }
    },
    [activeWorkspace]
  );

  // 15. Tag Creation
  const handleCreateTag = useCallback(
    async (tagName: string) => {
      if (!activeWorkspace) return;
      try {
        const created = await api.createTag(activeWorkspace.id, tagName);
        setTags((prev) => [...prev, created]);
      } catch (err) {
        // Tag may already exist, ignore
      }
    },
    [activeWorkspace]
  );

  // 16. Undo & Redo Handlers
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const prevIndex = historyIndex - 1;
    const snapshot = history[prevIndex];
    isUndoRedoAction.current = true;
    setKnowledgeNodes(snapshot.nodes);
    setConnections(snapshot.connections);
    setHistoryIndex(prevIndex);
    setTimeout(() => {
      isUndoRedoAction.current = false;
    }, 50);
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    const snapshot = history[nextIndex];
    isUndoRedoAction.current = true;
    setKnowledgeNodes(snapshot.nodes);
    setConnections(snapshot.connections);
    setHistoryIndex(nextIndex);
    setTimeout(() => {
      isUndoRedoAction.current = false;
    }, 50);
  }, [history, historyIndex]);

  // Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Escape') {
        setSelectedNodeId(null);
        setContextMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Context Menu handlers
  const handlePaneContextMenu = useCallback((e: MouseEvent | React.MouseEvent) => {
    e.preventDefault();
    const canvasPos = reactFlow.screenToFlowPosition({
      x: e.clientX,
      y: e.clientY,
    });
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      canvasX: Math.round(canvasPos.x),
      canvasY: Math.round(canvasPos.y),
    });
  }, [reactFlow]);

  const handleNodeContextMenu = useCallback((e: MouseEvent | React.MouseEvent, node: Node) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      canvasX: node.position.x,
      canvasY: node.position.y,
      nodeId: node.id,
    });
  }, []);

  const activeSelectedNode = useMemo(
    () => knowledgeNodes.find((n) => n.id === selectedNodeId) || null,
    [knowledgeNodes, selectedNodeId]
  );

  return (
    <div
      style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 }}
      className="flex overflow-hidden bg-[#fffbfd] font-sans text-slate-800 select-none"
    >
      {/* Left Sidebar */}
      <Sidebar
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        nodes={knowledgeNodes}
        tags={tags}
        activeTagFilter={activeTagFilter}
        searchQuery={searchQuery}
        onSelectWorkspace={(ws) => setActiveWorkspace(ws)}
        onCreateWorkspace={handleCreateWorkspace}
        onSearchChange={setSearchQuery}
        onSelectNode={handleJumpToNode}
        onTagFilterToggle={setActiveTagFilter}
        onRestoreNode={(id) => handleUpdateNode(id, { is_deleted: 0 })}
        onPermanentDeleteNode={(id) => setDeleteModalNodeId(id)}
        onCreateNode={() => handleCreateNode()}
        showMinimap={showMinimap}
        onToggleMinimap={() => setShowMinimap(!showMinimap)}
        gridType={gridType}
        onChangeGridType={setGridType}
        snapToGrid={snapToGrid}
        onToggleSnapToGrid={() => setSnapToGrid(!snapToGrid)}
      />

      {/* Main Workspace Canvas Area */}
      <main
        style={{ width: '100%', height: '100%', minHeight: 0, minWidth: 0 }}
        className="relative flex-1 overflow-hidden"
      >
        {/* Floating Top Header */}
        <CanvasHeader
          workspace={activeWorkspace}
          saveStatus={saveStatus}
          nodeCount={knowledgeNodes.filter((n) => !n.is_deleted).length}
          connectionCount={connections.length}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          showMinimap={showMinimap}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onAddNode={() => handleCreateNode()}
          onFitView={() => reactFlow.fitView({ padding: 0.2, duration: 600 })}
          onZoomIn={() => reactFlow.zoomIn({ duration: 300 })}
          onZoomOut={() => reactFlow.zoomOut({ duration: 300 })}
          onToggleMinimap={() => setShowMinimap(!showMinimap)}
          onRenameWorkspace={handleRenameWorkspace}
          onRetrySave={() => {
            if (activeWorkspace) loadWorkspaceGraph(activeWorkspace.id);
          }}
        />

        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/60 backdrop-blur-xs">
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white border border-pink-200 shadow-2xl shadow-pink-500/10">
              <Loader2 className="w-5 h-5 text-pink-600 animate-spin" />
              <span className="text-sm font-semibold text-slate-700">Loading workspace graph...</span>
            </div>
          </div>
        )}

        {/* Empty Canvas First-Time Experience */}
        {!isLoading && knowledgeNodes.filter((n) => !n.is_deleted).length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="max-w-md p-8 rounded-3xl bg-white/95 border border-pink-200 backdrop-blur-xl shadow-2xl shadow-pink-500/10 text-center space-y-4 pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-400 flex items-center justify-center shadow-lg shadow-pink-300 text-white">
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-slate-800">Welcome to your Knowledge Graph</h2>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Start connecting ideas. Create nodes, drag connections between them, write notes, and explore relationships with Cloudflare D1 persistence.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCreateNode(400, 250)}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-sm font-bold shadow-md shadow-pink-300 hover:shadow-pink-400 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Create your first node
              </button>
            </div>
          </div>
        )}

        {/* React Flow Canvas */}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDrag={handleNodeDrag}
          onMoveEnd={handleMoveEnd}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onPaneClick={() => {
            setSelectedNodeId(null);
            setContextMenu(null);
          }}
          onPaneContextMenu={handlePaneContextMenu}
          onNodeContextMenu={handleNodeContextMenu}
          snapToGrid={snapToGrid}
          snapGrid={[20, 20]}
          minZoom={0.2}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
          style={{ width: '100%', height: '100%' }}
          className="h-full w-full"
        >
          <Background
            variant={
              gridType === 'dots'
                ? BackgroundVariant.Dots
                : gridType === 'lines'
                ? BackgroundVariant.Lines
                : BackgroundVariant.Cross
            }
            gap={24}
            size={gridType === 'dots' ? 1.5 : 1}
            color="#fbcfe8"
          />

          <Controls
            showInteractive={false}
            className="!bottom-6 !left-6 !bg-white/95 !border-pink-200 shadow-md shadow-pink-500/10"
          />

          {showMinimap && (
            <MiniMap
              zoomable
              pannable
              nodeColor={(n) => {
                const nodeData = n.data as unknown as KnowledgeNodeData;
                return nodeData?.color && nodeData.color !== '#1e293b' ? nodeData.color : '#ec4899';
              }}
              className="!bottom-6 !right-6 !m-0"
            />
          )}
        </ReactFlow>

        {/* Context Menu */}
        <ContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onCreateNodeAt={(x, y) => handleCreateNode(x, y)}
          onFitView={() => reactFlow.fitView({ padding: 0.2, duration: 600 })}
          onToggleMinimap={() => setShowMinimap(!showMinimap)}
          onDuplicateNode={(id) => handleDuplicateNode(id)}
          onDeleteNode={(id) => setDeleteModalNodeId(id)}
          onAddChildNode={(id) => handleAddChildNode(id)}
          onToggleFavorite={(id) => {
            const node = knowledgeNodes.find((n) => n.id === id);
            if (node) handleToggleFavorite(id, !node.is_favorite);
          }}
        />
      </main>

      {/* Right Detail Panel */}
      {selectedNodeId && (
        <DetailPanel
          node={activeSelectedNode}
          allNodes={knowledgeNodes.filter((n) => !n.is_deleted)}
          connections={connections}
          workspaceTags={tags}
          onClose={() => setSelectedNodeId(null)}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={(id) => setDeleteModalNodeId(id)}
          onDuplicateNode={handleDuplicateNode}
          onCreateConnection={handleCreateConnectionFromPanel}
          onDeleteConnection={handleDeleteConnection}
          onJumpToNode={handleJumpToNode}
          onCreateTag={handleCreateTag}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteModalNodeId)}
        title="Delete Node"
        message="Are you sure you want to delete this node? All associated connections will be removed."
        confirmLabel="Delete"
        isDestructive
        onConfirm={handleConfirmDeleteNode}
        onCancel={() => setDeleteModalNodeId(null)}
      />
    </div>
  );
};

export default function App() {
  return (
    <ReactFlowProvider>
      <CanvasFlow />
    </ReactFlowProvider>
  );
}
