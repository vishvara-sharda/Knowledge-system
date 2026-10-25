import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Search,
  Star,
  Clock,
  Tag as TagIcon,
  Trash2,
  Settings,
  ChevronDown,
  Database,
  RotateCcw,
  PanelLeftClose,
  PanelLeftOpen,
  Check,
} from 'lucide-react';
import type { Workspace, KnowledgeNode, Tag } from '../types';

interface SidebarProps {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  nodes: KnowledgeNode[];
  tags: Tag[];
  activeTagFilter: string | null;
  searchQuery: string;
  onSelectWorkspace: (ws: Workspace) => void;
  onCreateWorkspace: (name: string) => void;
  onSearchChange: (q: string) => void;
  onSelectNode: (nodeId: string) => void;
  onTagFilterToggle: (tagName: string | null) => void;
  onRestoreNode: (nodeId: string) => void;
  onPermanentDeleteNode: (nodeId: string) => void;
  onCreateNode: () => void;
  // Settings toggles
  showMinimap: boolean;
  onToggleMinimap: () => void;
  gridType: 'dots' | 'lines' | 'cross';
  onChangeGridType: (type: 'dots' | 'lines' | 'cross') => void;
  snapToGrid: boolean;
  onToggleSnapToGrid: () => void;
}

type SidebarTab = 'nodes' | 'favorites' | 'recent' | 'tags' | 'trash' | 'settings';

export const Sidebar: React.FC<SidebarProps> = ({
  workspaces,
  activeWorkspace,
  nodes,
  tags,
  activeTagFilter,
  searchQuery,
  onSelectWorkspace,
  onCreateWorkspace,
  onSearchChange,
  onSelectNode,
  onTagFilterToggle,
  onRestoreNode,
  onPermanentDeleteNode,
  onCreateNode,
  showMinimap,
  onToggleMinimap,
  gridType,
  onChangeGridType,
  snapToGrid,
  onToggleSnapToGrid,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>('nodes');
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  // Active nodes (not deleted)
  const activeNodes = nodes.filter((n) => !n.is_deleted);
  const favoriteNodes = activeNodes.filter((n) => n.is_favorite);
  const recentNodes = [...activeNodes].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  ).slice(0, 10);
  const trashNodes = nodes.filter((n) => n.is_deleted);

  // Search filtered nodes
  const displayNodes = searchQuery
    ? activeNodes.filter(
        (n) =>
          n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (n.content && n.content.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : activeTagFilter
    ? activeNodes.filter((n) => (n.tags || []).includes(activeTagFilter))
    : activeNodes;

  const handleCreateWorkspaceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newWorkspaceName.trim()) {
      onCreateWorkspace(newWorkspaceName.trim());
      setNewWorkspaceName('');
      setIsCreatingWorkspace(false);
      setShowWorkspaceMenu(false);
    }
  };

  if (collapsed) {
    return (
      <div className="w-14 h-full bg-[#0d121f]/95 border-r border-slate-800 flex flex-col items-center py-4 gap-4 z-20 backdrop-blur-md">
        <button
          type="button"
          title="Expand sidebar"
          onClick={() => setCollapsed(false)}
          className="p-2.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <PanelLeftOpen className="w-5 h-5" />
        </button>
        <button
          type="button"
          title="Create node"
          onClick={onCreateNode}
          className="p-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-72 h-full bg-[#0d121f]/95 border-r border-slate-800 flex flex-col z-20 shadow-xl backdrop-blur-xl transition-all duration-300">
      {/* Workspace Switcher Header */}
      <div className="p-3.5 border-b border-slate-800/80">
        <div className="relative">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
              className="flex items-center gap-2.5 flex-1 min-w-0 p-2 rounded-lg hover:bg-slate-800/60 transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-white shrink-0 shadow-sm shadow-indigo-500/40">
                <Layers className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-slate-400 block font-medium">Workspace</span>
                <span className="text-sm font-semibold text-slate-100 truncate block">
                  {activeWorkspace?.name || 'Select Workspace'}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            <button
              type="button"
              title="Collapse sidebar"
              onClick={() => setCollapsed(true)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0 ml-1"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* Workspace Dropdown */}
          {showWorkspaceMenu && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">
                Your Workspaces
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => {
                      onSelectWorkspace(ws);
                      setShowWorkspaceMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors ${
                      ws.id === activeWorkspace?.id
                        ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="truncate">{ws.name}</span>
                    {ws.id === activeWorkspace?.id && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                  </button>
                ))}
              </div>

              {isCreatingWorkspace ? (
                <form onSubmit={handleCreateWorkspaceSubmit} className="pt-2 mt-2 border-t border-slate-800 space-y-1.5">
                  <input
                    type="text"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="Workspace name..."
                    autoFocus
                    className="w-full bg-slate-800 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      type="submit"
                      className="flex-1 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingWorkspace(false)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-400 text-xs transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCreatingWorkspace(true)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 mt-1 rounded-lg text-xs font-medium text-indigo-400 hover:bg-indigo-950/40 border border-dashed border-indigo-500/30 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Create Workspace
                </button>
              )}
            </div>
          )}
        </div>

        {/* Global Add Node Button */}
        <button
          type="button"
          onClick={onCreateNode}
          className="w-full mt-3 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 hover:shadow-indigo-600/40 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add New Node
        </button>
      </div>

      {/* Search Input */}
      <div className="px-3.5 py-2.5 border-b border-slate-800/80">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search nodes or notes..."
            className="w-full bg-slate-900/80 border border-slate-750 rounded-lg pl-8.5 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Nav Tabs */}
      <div className="grid grid-cols-5 px-3 py-2 border-b border-slate-800/80 gap-1 bg-slate-900/30">
        <button
          type="button"
          title="All Nodes"
          onClick={() => setActiveTab('nodes')}
          className={`py-1.5 rounded flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === 'nodes' ? 'text-indigo-400 bg-slate-800/80' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="text-[10px] font-medium">Nodes</span>
        </button>
        <button
          type="button"
          title="Favorites"
          onClick={() => setActiveTab('favorites')}
          className={`py-1.5 rounded flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === 'favorites' ? 'text-amber-400 bg-slate-800/80' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Star className="w-3.5 h-3.5" />
          <span className="text-[10px] font-medium">Favs</span>
        </button>
        <button
          type="button"
          title="Recent"
          onClick={() => setActiveTab('recent')}
          className={`py-1.5 rounded flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === 'recent' ? 'text-blue-400 bg-slate-800/80' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span className="text-[10px] font-medium">Recent</span>
        </button>
        <button
          type="button"
          title="Tags & Categories"
          onClick={() => setActiveTab('tags')}
          className={`py-1.5 rounded flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === 'tags' ? 'text-purple-400 bg-slate-800/80' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TagIcon className="w-3.5 h-3.5" />
          <span className="text-[10px] font-medium">Tags</span>
        </button>
        <button
          type="button"
          title="Trash & Deleted"
          onClick={() => setActiveTab('trash')}
          className={`py-1.5 rounded flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === 'trash' ? 'text-rose-400 bg-slate-800/80' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="text-[10px] font-medium">Trash</span>
        </button>
      </div>

      {/* Tab Content List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {activeTab === 'nodes' && (
          <>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2 pb-1">
              <span>
                {activeTagFilter ? `Tag: #${activeTagFilter}` : searchQuery ? 'Search Results' : 'Workspace Nodes'}
              </span>
              <span className="text-slate-400">{displayNodes.length}</span>
            </div>

            {activeTagFilter && (
              <div className="px-2 pb-2">
                <button
                  type="button"
                  onClick={() => onTagFilterToggle(null)}
                  className="text-xs text-indigo-400 hover:underline flex items-center gap-1"
                >
                  Clear tag filter ({activeTagFilter}) ×
                </button>
              </div>
            )}

            {displayNodes.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs italic">
                {searchQuery ? 'No nodes matching search' : 'No nodes yet. Create your first node!'}
              </div>
            ) : (
              displayNodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onSelectNode(node.id)}
                  className="w-full text-left p-2 rounded-lg bg-slate-900/40 hover:bg-slate-800/70 border border-slate-800/60 hover:border-slate-700/80 transition-all flex items-start gap-2 group"
                >
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: node.color || '#6366f1' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-medium text-slate-200 truncate group-hover:text-indigo-300">
                        {node.title || 'Untitled Node'}
                      </span>
                      {node.is_favorite === 1 && (
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                      )}
                    </div>
                    {node.content && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {node.content}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </>
        )}

        {activeTab === 'favorites' && (
          <>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2 pb-1">
              <span>Starred Nodes</span>
              <span className="text-slate-400">{favoriteNodes.length}</span>
            </div>

            {favoriteNodes.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs italic">
                No favorite nodes starred yet
              </div>
            ) : (
              favoriteNodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onSelectNode(node.id)}
                  className="w-full text-left p-2 rounded-lg bg-slate-900/40 hover:bg-slate-800/70 border border-slate-800/60 hover:border-slate-700/80 transition-all flex items-start gap-2 group"
                >
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-slate-200 truncate block group-hover:text-amber-300">
                      {node.title || 'Untitled Node'}
                    </span>
                    {node.content && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {node.content}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </>
        )}

        {activeTab === 'recent' && (
          <>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2 pb-1">
              <span>Recently Updated</span>
              <span className="text-slate-400">{recentNodes.length}</span>
            </div>

            {recentNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelectNode(node.id)}
                className="w-full text-left p-2 rounded-lg bg-slate-900/40 hover:bg-slate-800/70 border border-slate-800/60 transition-all flex items-start gap-2 group"
              >
                <Clock className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-slate-200 truncate block group-hover:text-blue-300">
                    {node.title || 'Untitled Node'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(node.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </button>
            ))}
          </>
        )}

        {activeTab === 'tags' && (
          <>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2 pb-1">
              <span>Categories & Tags</span>
              <span className="text-slate-400">{tags.length}</span>
            </div>

            {tags.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs italic">
                No tags created yet. Add tags in node details!
              </div>
            ) : (
              <div className="space-y-1">
                {tags.map((tag) => {
                  const count = activeNodes.filter((n) => (n.tags || []).includes(tag.name)).length;
                  const isSelected = activeTagFilter === tag.name;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => onTagFilterToggle(isSelected ? null : tag.name)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-medium transition-colors ${
                        isSelected
                          ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40'
                          : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <TagIcon className="w-3.5 h-3.5 text-purple-400" />
                        <span>#{tag.name}</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 rounded-full text-slate-400">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === 'trash' && (
          <>
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2 pb-1">
              <span>Trash & Deleted</span>
              <span className="text-slate-400">{trashNodes.length}</span>
            </div>

            {trashNodes.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs italic">
                Trash is empty
              </div>
            ) : (
              trashNodes.map((node) => (
                <div
                  key={node.id}
                  className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/80 flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-slate-300 truncate block line-through">
                      {node.title || 'Untitled Node'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Restore node"
                      onClick={() => onRestoreNode(node.id)}
                      className="p-1 rounded text-emerald-400 hover:bg-emerald-950/40 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Permanently delete"
                      onClick={() => onPermanentDeleteNode(node.id)}
                      className="p-1 rounded text-rose-400 hover:bg-rose-950/40 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* Settings & System Footer */}
      <div className="p-3 border-t border-slate-800/80 space-y-2 bg-slate-900/40">
        {/* Settings Toggle Accordion */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Settings className="w-3 h-3" /> Canvas Options
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <button
              type="button"
              onClick={onToggleMinimap}
              className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                showMinimap
                  ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
                  : 'border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              Minimap: {showMinimap ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              onClick={onToggleSnapToGrid}
              className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                snapToGrid
                  ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
                  : 'border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              Snap Grid: {snapToGrid ? 'On' : 'Off'}
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1">
            <span className="text-slate-500">Grid Pattern:</span>
            <div className="flex items-center gap-1">
              {(['dots', 'lines', 'cross'] as const).map((pattern) => (
                <button
                  key={pattern}
                  type="button"
                  onClick={() => onChangeGridType(pattern)}
                  className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-mono border transition-colors ${
                    gridType === pattern
                      ? 'border-indigo-400 text-indigo-300 bg-indigo-950/40'
                      : 'border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {pattern}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Database Status Bar */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <Database className="w-3 h-3 text-emerald-400" />
            <span className="font-mono text-[10px] text-emerald-400">Cloudflare D1 (SQLite)</span>
          </div>
          <span className="text-[10px] text-slate-600">Active</span>
        </div>
      </div>
    </aside>
  );
};
