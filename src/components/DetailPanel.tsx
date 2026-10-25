import React, { useState, useEffect } from 'react';
import {
  X,
  Star,
  Trash2,
  Copy,
  Plus,
  ArrowRight,
  ArrowLeft,
  Tag as TagIcon,
  ExternalLink,
  Unlink,
  Palette,
  Calendar,
} from 'lucide-react';
import type { KnowledgeNode, Connection, Tag } from '../types';

interface DetailPanelProps {
  node: KnowledgeNode | null;
  allNodes: KnowledgeNode[];
  connections: Connection[];
  workspaceTags: Tag[];
  onClose: () => void;
  onUpdateNode: (id: string, updates: Partial<KnowledgeNode>) => void;
  onDeleteNode: (id: string) => void;
  onDuplicateNode: (id: string) => void;
  onCreateConnection: (sourceId: string, targetId: string, relationship?: string) => void;
  onDeleteConnection: (connectionId: string) => void;
  onJumpToNode: (nodeId: string) => void;
  onCreateTag: (tagName: string) => void;
}

const COLOR_PRESETS = [
  { name: 'Hot Pink', value: '#ec4899' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Blush', value: '#fb7185' },
  { name: 'Fuchsia', value: '#d946ef' },
  { name: 'Berry', value: '#be185d' },
  { name: 'Lavender', value: '#c084fc' },
  { name: 'Coral', value: '#fb923c' },
];

export const DetailPanel: React.FC<DetailPanelProps> = ({
  node,
  allNodes,
  connections,
  workspaceTags,
  onClose,
  onUpdateNode,
  onDeleteNode,
  onDuplicateNode,
  onCreateConnection,
  onDeleteConnection,
  onJumpToNode,
  onCreateTag,
}) => {
  if (!node) return null;

  const [title, setTitle] = useState(node.title);
  const [content, setContent] = useState(node.content || '');
  const [newTagInput, setNewTagInput] = useState('');
  const [targetNodeToConnect, setTargetNodeToConnect] = useState('');
  const [connectionLabelInput, setConnectionLabelInput] = useState('');

  // Sync internal state when active node changes
  useEffect(() => {
    setTitle(node.title);
    setContent(node.content || '');
    setTargetNodeToConnect('');
    setConnectionLabelInput('');
  }, [node.id, node.title, node.content]);

  // Handle immediate or blurred save
  const handleTitleBlur = () => {
    if (title.trim() !== node.title) {
      onUpdateNode(node.id, { title: title.trim() || 'Untitled Node' });
    }
  };

  const handleContentBlur = () => {
    if (content !== node.content) {
      onUpdateNode(node.id, { content });
    }
  };

  // Tag management
  const handleAddTag = (tagName: string) => {
    const clean = tagName.trim();
    if (!clean) return;
    const currentTags = node.tags || [];
    if (!currentTags.includes(clean)) {
      const nextTags = [...currentTags, clean];
      onUpdateNode(node.id, { tags: nextTags });
      onCreateTag(clean);
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = node.tags || [];
    const nextTags = currentTags.filter((t) => t !== tagToRemove);
    onUpdateNode(node.id, { tags: nextTags });
  };

  // Connected nodes lookup
  const outgoingConnections = connections.filter((c) => c.source_node_id === node.id);
  const incomingConnections = connections.filter((c) => c.target_node_id === node.id);

  const availableNodesToConnect = allNodes.filter(
    (n) =>
      n.id !== node.id &&
      !outgoingConnections.some((c) => c.target_node_id === n.id) &&
      !incomingConnections.some((c) => c.source_node_id === n.id)
  );

  return (
    <aside className="w-96 h-full bg-white/98 border-l border-pink-100 backdrop-blur-xl flex flex-col z-30 shadow-xl shadow-pink-500/5 transition-all duration-300 font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-pink-100/80">
        <div className="flex items-center gap-2">
          <button
            type="button"
            title={node.is_favorite ? 'Remove favorite' : 'Add to favorites'}
            onClick={() => onUpdateNode(node.id, { is_favorite: node.is_favorite ? 0 : 1 })}
            className={`p-1.5 rounded-xl border transition-all ${
              node.is_favorite
                ? 'border-pink-300 bg-pink-50 text-pink-500'
                : 'border-pink-200 text-slate-300 hover:text-pink-500 hover:bg-pink-50/50'
            }`}
          >
            <Star className="w-4 h-4" fill={node.is_favorite ? 'currentColor' : 'none'} />
          </button>
          <span className="text-xs font-mono text-pink-400 font-medium truncate max-w-[140px]">
            {node.id}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title="Duplicate node"
            onClick={() => onDuplicateNode(node.id)}
            className="p-1.5 rounded-xl border border-pink-100 text-slate-500 hover:text-pink-600 hover:bg-pink-50 transition-colors"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Delete node"
            onClick={() => onDeleteNode(node.id)}
            className="p-1.5 rounded-xl border border-rose-100 text-rose-500 hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Close panel"
            onClick={onClose}
            className="p-1.5 rounded-xl border border-pink-100 text-slate-400 hover:text-pink-600 hover:bg-pink-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {/* Title Input */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-pink-500 uppercase tracking-wider">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleBlur();
            }}
            placeholder="Node title..."
            className="w-full bg-pink-50/30 border border-pink-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-500 transition-all font-semibold"
          />
        </div>

        {/* Color Palette Selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-pink-500 uppercase tracking-wider">
            <Palette className="w-3.5 h-3.5" />
            <span>Accent Color</span>
          </div>
          <div className="flex items-center gap-2">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                title={preset.name}
                onClick={() => onUpdateNode(node.id, { color: preset.value })}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  (node.color || '#ec4899') === preset.value
                    ? 'border-white scale-110 shadow-md shadow-pink-500/30 ring-2 ring-pink-500'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: preset.value }}
              />
            ))}
          </div>
        </div>

        {/* Content Notes */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-pink-500 uppercase tracking-wider">
            Notes & Content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleContentBlur}
            rows={7}
            placeholder="Write notes, thoughts, markdown details, or links..."
            className="w-full bg-pink-50/30 border border-pink-200 rounded-xl p-3 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-500 transition-all resize-y leading-relaxed font-normal"
          />
        </div>

        {/* Tags Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-pink-500 uppercase tracking-wider">
            <TagIcon className="w-3.5 h-3.5" />
            <span>Tags</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {node.tags && node.tags.length > 0 ? (
              node.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-pink-50 text-pink-700 border border-pink-200"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-pink-400 hover:text-rose-500 transition-colors ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            ) : (
              <span className="text-xs text-pink-300 italic">No tags assigned</span>
            )}
          </div>

          {/* Add Tag Input */}
          <div className="flex items-center gap-1.5 pt-1">
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag(newTagInput);
                }
              }}
              placeholder="Add tag and press Enter..."
              className="flex-1 bg-pink-50/40 border border-pink-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-pink-500"
            />
            <button
              type="button"
              onClick={() => handleAddTag(newTagInput)}
              className="px-3 py-1.5 rounded-xl bg-pink-50 text-pink-600 border border-pink-200 hover:bg-pink-100 text-xs font-bold transition-colors"
            >
              Add
            </button>
          </div>

          {/* Suggested workspace tags */}
          {workspaceTags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              <span className="text-[11px] text-pink-400 self-center mr-1 font-medium">Workspace tags:</span>
              {workspaceTags
                .filter((wt) => !(node.tags || []).includes(wt.name))
                .slice(0, 5)
                .map((wt) => (
                  <button
                    key={wt.id}
                    type="button"
                    onClick={() => handleAddTag(wt.name)}
                    className="text-[10px] px-2 py-0.5 bg-pink-50 hover:bg-pink-100 text-pink-600 border border-pink-200 rounded-full font-semibold transition-colors"
                  >
                    +{wt.name}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Connections Section */}
        <div className="space-y-3 pt-2 border-t border-pink-100">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-pink-500 uppercase tracking-wider">
              Connections ({outgoingConnections.length + incomingConnections.length})
            </span>
          </div>

          {/* Outgoing connections */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-pink-400 font-semibold flex items-center gap-1">
              <ArrowRight className="w-3 h-3 text-pink-500" /> Connects To (Outgoing)
            </span>
            {outgoingConnections.length === 0 ? (
              <p className="text-xs text-slate-400 italic pl-2">No outgoing connections</p>
            ) : (
              outgoingConnections.map((conn) => {
                const targetNode = allNodes.find((n) => n.id === conn.target_node_id);
                return (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-pink-50/30 border border-pink-100 hover:border-pink-300 transition-all shadow-xs"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <ArrowRight className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => onJumpToNode(conn.target_node_id)}
                          className="text-xs font-semibold text-slate-800 hover:text-pink-600 truncate text-left block w-full transition-colors"
                        >
                          {targetNode?.title || 'Unknown Node'}
                        </button>
                        {conn.relationship && (
                          <span className="text-[10px] text-pink-500 font-mono">
                            [{conn.relationship}]
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        title="Jump to node on canvas"
                        onClick={() => onJumpToNode(conn.target_node_id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-pink-600 hover:bg-pink-50 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Disconnect"
                        onClick={() => onDeleteConnection(conn.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Incoming connections */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] text-pink-400 font-semibold flex items-center gap-1">
              <ArrowLeft className="w-3 h-3 text-pink-500" /> Connected From (Incoming)
            </span>
            {incomingConnections.length === 0 ? (
              <p className="text-xs text-slate-400 italic pl-2">No incoming connections</p>
            ) : (
              incomingConnections.map((conn) => {
                const sourceNode = allNodes.find((n) => n.id === conn.source_node_id);
                return (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-pink-50/30 border border-pink-100 hover:border-pink-300 transition-all shadow-xs"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <ArrowLeft className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => onJumpToNode(conn.source_node_id)}
                          className="text-xs font-semibold text-slate-800 hover:text-pink-600 truncate text-left block w-full transition-colors"
                        >
                          {sourceNode?.title || 'Unknown Node'}
                        </button>
                        {conn.relationship && (
                          <span className="text-[10px] text-pink-500 font-mono">
                            [{conn.relationship}]
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        title="Jump to node on canvas"
                        onClick={() => onJumpToNode(conn.source_node_id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-pink-600 hover:bg-pink-50 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Disconnect"
                        onClick={() => onDeleteConnection(conn.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Connect Another Node Form */}
          {availableNodesToConnect.length > 0 && (
            <div className="p-3.5 bg-pink-50/30 border border-pink-200 rounded-xl space-y-2 mt-2">
              <span className="text-xs font-bold text-pink-600 block">
                Connect to another node:
              </span>
              <select
                value={targetNodeToConnect}
                onChange={(e) => setTargetNodeToConnect(e.target.value)}
                className="w-full bg-white border border-pink-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-pink-500"
              >
                <option value="">Select a target node...</option>
                {availableNodesToConnect.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title || 'Untitled Node'}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={connectionLabelInput}
                onChange={(e) => setConnectionLabelInput(e.target.value)}
                placeholder="Relationship label (e.g. leads to, requires)..."
                className="w-full bg-white border border-pink-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-pink-500"
              />

              <button
                type="button"
                disabled={!targetNodeToConnect}
                onClick={() => {
                  if (targetNodeToConnect) {
                    onCreateConnection(node.id, targetNodeToConnect, connectionLabelInput.trim() || undefined);
                    setTargetNodeToConnect('');
                    setConnectionLabelInput('');
                  }
                }}
                className="w-full py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-pink-300 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Create Connection
              </button>
            </div>
          )}
        </div>

        {/* Metadata info */}
        <div className="pt-3 border-t border-pink-100 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-pink-400" />
            <span>Created: {new Date(node.created_at).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-pink-400" />
            <span>Updated: {new Date(node.updated_at).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
