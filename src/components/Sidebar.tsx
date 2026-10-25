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

type SidebarTab = 'nodes' | 'favorites' | 'recent' | 'tags' | 'trash';

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
      <div className="w-14 h-full bg-white border-r border-pink-100 flex flex-col items-center py-4 gap-4 z-20 shadow-sm">
        <button
          type="button"
          title="Expand sidebar"
          onClick={() => setCollapsed(false)}
          className="p-2.5 rounded-xl text-slate-400 hover:text-pink-600 hover:bg-pink-50 transition-colors"
        >
          <PanelLeftOpen className="w-5 h-5" />
        </button>
        <button
          type="button"
          title="Create node"
          onClick={onCreateNode}
          className="p-2.5 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-500 text-white shadow-md shadow-pink-300 hover:shadow-pink-400 hover:scale-105 transition-all"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-72 h-full bg-white/95 border-r border-pink-100 flex flex-col z-20 shadow-sm backdrop-blur-xl transition-all duration-300 font-sans">
      {/* Workspace Switcher Header */}
      <div className="p-3.5 border-b border-pink-100/80">
        <div className="relative">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
              className="flex items-center gap-2.5 flex-1 min-w-0 p-2 rounded-xl hover:bg-pink-50/60 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-400 flex items-center justify-center text-white shrink-0 shadow-md shadow-pink-300/40">
                <Layers className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] text-pink-400 font-medium block">Workspace</span>
                <span className="text-sm font-bold text-slate-800 truncate block tracking-tight">
                  {activeWorkspace?.name || 'Select Workspace'}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-pink-400 shrink-0" />
            </button>

            <button
              type="button"
              title="Collapse sidebar"
              onClick={() => setCollapsed(true)}
              className="p-2 rounded-lg text-slate-400 hover:text-pink-600 hover:bg-pink-50 transition-colors shrink-0 ml-1"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* Workspace Dropdown */}
          {showWorkspaceMenu && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-pink-200 rounded-2xl shadow-xl shadow-pink-500/10 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="text-[11px] font-bold text-pink-500 uppercase tracking-wider px-2 py-1">
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
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                      ws.id === activeWorkspace?.id
                        ? 'bg-pink-50 text-pink-700 border border-pink-200'
                        : 'text-slate-700 hover:bg-pink-50/60 hover:text-pink-600'
                    }`}
                  >
                    <span className="truncate">{ws.name}</span>
                    {ws.id === activeWorkspace?.id && <Check className="w-3.5 h-3.5 text-pink-600 shrink-0" />}
                  </button>
                ))}
              </div>

              {isCreatingWorkspace ? (
                <form onSubmit={handleCreateWorkspaceSubmit} className="pt-2 mt-2 border-t border-pink-100 space-y-1.5">
                  <input
                    type="text"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="Workspace name..."
                    autoFocus
                    className="w-full bg-pink-50/40 border border-pink-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-pink-500"
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      type="submit"
                      className="flex-1 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold shadow-sm transition-colors"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingWorkspace(false)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCreatingWorkspace(true)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 mt-1 rounded-xl text-xs font-semibold text-pink-600 hover:bg-pink-50 border border-dashed border-pink-200 transition-colors"
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
          className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-xs font-bold shadow-md shadow-pink-300/50 hover:shadow-pink-300/80 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add New Node
        </button>
      </div>

      {/* Search Input */}
      <div className="px-3.5 py-2.5 border-b border-pink-100/80">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-pink-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search nodes or notes..."
            className="w-full bg-pink-50/40 border border-pink-200 rounded-xl pl-8.5 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-pink-400 hover:text-pink-600 text-xs font-bold"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Nav Tabs */}
      <div className="grid grid-cols-5 px-3 py-2 border-b border-pink-100/80 gap-1 bg-pink-50/20">
        <button
          type="button"
          title="All Nodes"
          onClick={() => setActiveTab('nodes')}
          className={`py-1.5 rounded-lg flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === 'nodes' ? 'text-pink-600 bg-pink-50 font-semibold' : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="text-[10px]">Nodes</span>
        </button>
        <button
          type="button"
          title="Favorites"
          onClick={() => setActiveTab('favorites')}
          className={`py-1.5 rounded-lg flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === 'favorites' ? 'text-pink-600 bg-pink-50 font-semibold' : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <Star className="w-3.5 h-3.5" />
          <span className="text-[10px]">Favs</span>
        </button>
        <button
          type="button"
          title="Recent"
          onClick={() => setActiveTab('recent')}
          className={`py-1.5 rounded-lg flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === 'recent' ? 'text-pink-600 bg-pink-50 font-semibold' : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span className="text-[10px]">Recent</span>
        </button>
        <button
          type="button"
          title="Tags & Categories"
          onClick={() => setActiveTab('tags')}
          className={`py-1.5 rounded-lg flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === 'tags' ? 'text-pink-600 bg-pink-50 font-semibold' : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <TagIcon className="w-3.5 h-3.5" />
          <span className="text-[10px]">Tags</span>
        </button>
        <button
          type="button"
          title="Trash & Deleted"
          onClick={() => setActiveTab('trash')}
          className={`py-1.5 rounded-lg flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === 'trash' ? 'text-rose-600 bg-rose-50 font-semibold' : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="text-[10px]">Trash</span>
        </button>
      </div>

      {/* Tab Content List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {activeTab === 'nodes' && (
          <>
            <div className="flex items-center justify-between text-[11px] font-bold text-pink-400 uppercase tracking-wider px-2 pb-1">
              <span>
                {activeTagFilter ? `Tag: #${activeTagFilter}` : searchQuery ? 'Search Results' : 'Workspace Nodes'}
              </span>
              <span className="text-pink-500 font-semibold">{displayNodes.length}</span>
            </div>

            {activeTagFilter && (
              <div className="px-2 pb-2">
                <button
                  type="button"
                  onClick={() => onTagFilterToggle(null)}
                  className="text-xs text-pink-600 font-semibold hover:underline flex items-center gap-1"
                >
                  Clear tag filter ({activeTagFilter}) ×
                </button>
              </div>
            )}

            {displayNodes.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs italic">
                {searchQuery ? 'No nodes matching search' : 'No nodes yet. Create your first node!'}
              </div>
            ) : (
              displayNodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onSelectNode(node.id)}
                  className="w-full text-left p-2.5 rounded-xl bg-white hover:bg-pink-50/50 border border-pink-100 hover:border-pink-300 transition-all flex items-start gap-2.5 group shadow-xs"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 shadow-xs"
                    style={{ backgroundColor: node.color && node.color !== '#1e293b' ? node.color : '#ec4899' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-slate-800 truncate group-hover:text-pink-600">
                        {node.title || 'Untitled Node'}
                      </span>
                      {node.is_favorite === 1 && (
                        <Star className="w-3.5 h-3.5 text-pink-500 fill-pink-500 shrink-0" />
                      )}
                    </div>
                    {node.content && (
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
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
            <div className="flex items-center justify-between text-[11px] font-bold text-pink-400 uppercase tracking-wider px-2 pb-1">
              <span>Starred Nodes</span>
              <span className="text-pink-500 font-semibold">{favoriteNodes.length}</span>
            </div>

            {favoriteNodes.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs italic">
                No favorite nodes starred yet
              </div>
            ) : (
              favoriteNodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onSelectNode(node.id)}
                  className="w-full text-left p-2.5 rounded-xl bg-white hover:bg-pink-50/50 border border-pink-100 hover:border-pink-300 transition-all flex items-start gap-2.5 group shadow-xs"
                >
                  <Star className="w-3.5 h-3.5 text-pink-500 fill-pink-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-slate-800 truncate block group-hover:text-pink-600">
                      {node.title || 'Untitled Node'}
                    </span>
                    {node.content && (
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
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
            <div className="flex items-center justify-between text-[11px] font-bold text-pink-400 uppercase tracking-wider px-2 pb-1">
              <span>Recently Updated</span>
              <span className="text-pink-500 font-semibold">{recentNodes.length}</span>
            </div>

            {recentNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelectNode(node.id)}
                className="w-full text-left p-2.5 rounded-xl bg-white hover:bg-pink-50/50 border border-pink-100 hover:border-pink-300 transition-all flex items-start gap-2.5 group shadow-xs"
              >
                <Clock className="w-3.5 h-3.5 text-pink-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-slate-800 truncate block group-hover:text-pink-600">
                    {node.title || 'Untitled Node'}
                  </span>
                  <span className="text-[10px] text-pink-400 font-medium">
                    {new Date(node.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </button>
            ))}
          </>
        )}

        {activeTab === 'tags' && (
          <>
            <div className="flex items-center justify-between text-[11px] font-bold text-pink-400 uppercase tracking-wider px-2 pb-1">
              <span>Categories & Tags</span>
              <span className="text-pink-500 font-semibold">{tags.length}</span>
            </div>

            {tags.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs italic">
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
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition-colors ${
                        isSelected
                          ? 'bg-pink-100 text-pink-800 border border-pink-300 shadow-xs'
                          : 'text-slate-700 hover:bg-pink-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <TagIcon className="w-3.5 h-3.5 text-pink-500" />
                        <span>#{tag.name}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 bg-pink-50 text-pink-600 rounded-full font-bold">
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
            <div className="flex items-center justify-between text-[11px] font-bold text-rose-400 uppercase tracking-wider px-2 pb-1">
              <span>Trash & Deleted</span>
              <span className="text-rose-500 font-semibold">{trashNodes.length}</span>
            </div>

            {trashNodes.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs italic">
                Trash is empty
              </div>
            ) : (
              trashNodes.map((node) => (
                <div
                  key={node.id}
                  className="p-2.5 rounded-xl bg-white border border-rose-100 flex items-center justify-between gap-2 shadow-xs"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-slate-500 truncate block line-through">
                      {node.title || 'Untitled Node'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Restore node"
                      onClick={() => onRestoreNode(node.id)}
                      className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Permanently delete"
                      onClick={() => onPermanentDeleteNode(node.id)}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
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
      <div className="p-3.5 border-t border-pink-100 space-y-2.5 bg-pink-50/20">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-pink-500 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Settings className="w-3 h-3" /> Canvas Options
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <button
              type="button"
              onClick={onToggleMinimap}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                showMinimap
                  ? 'border-pink-300 bg-pink-100 text-pink-700 shadow-xs'
                  : 'border-pink-200 text-slate-400 hover:text-slate-700 bg-white'
              }`}
            >
              Minimap: {showMinimap ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              onClick={onToggleSnapToGrid}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                snapToGrid
                  ? 'border-pink-300 bg-pink-100 text-pink-700 shadow-xs'
                  : 'border-pink-200 text-slate-400 hover:text-slate-700 bg-white'
              }`}
            >
              Snap Grid: {snapToGrid ? 'On' : 'Off'}
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1">
            <span className="text-slate-500 font-medium">Grid Pattern:</span>
            <div className="flex items-center gap-1">
              {(['dots', 'lines', 'cross'] as const).map((pattern) => (
                <button
                  key={pattern}
                  type="button"
                  onClick={() => onChangeGridType(pattern)}
                  className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-mono border transition-colors ${
                    gridType === pattern
                      ? 'border-pink-400 text-pink-700 bg-pink-100 font-bold'
                      : 'border-pink-200 text-slate-400 hover:text-slate-700 bg-white'
                  }`}
                >
                  {pattern}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Database Status Bar */}
        <div className="pt-2 border-t border-pink-100 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5">
            <Database className="w-3 h-3 text-pink-500" />
            <span className="font-semibold text-[10px] text-pink-600">Cloudflare D1 (SQLite)</span>
          </div>
          <span className="text-[10px] font-bold text-pink-500 bg-pink-100 px-2 py-0.5 rounded-full">
            Connected
          </span>
        </div>
      </div>
    </aside>
  );
};
