import React, { useState } from 'react';
import {
  Plus,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Map,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import type { Workspace, SaveStatus } from '../types';

interface CanvasHeaderProps {
  workspace: Workspace | null;
  saveStatus: SaveStatus;
  nodeCount: number;
  connectionCount: number;
  canUndo: boolean;
  canRedo: boolean;
  showMinimap: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAddNode: () => void;
  onFitView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleMinimap: () => void;
  onRenameWorkspace: (newName: string) => void;
  onRetrySave: () => void;
}

export const CanvasHeader: React.FC<CanvasHeaderProps> = ({
  workspace,
  saveStatus,
  nodeCount,
  connectionCount,
  canUndo,
  canRedo,
  showMinimap,
  onUndo,
  onRedo,
  onAddNode,
  onFitView,
  onZoomIn,
  onZoomOut,
  onToggleMinimap,
  onRenameWorkspace,
  onRetrySave,
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(workspace?.name || '');

  const handleStartRename = () => {
    setNameInput(workspace?.name || '');
    setIsRenaming(true);
  };

  const handleSaveRename = () => {
    if (nameInput.trim() && nameInput.trim() !== workspace?.name) {
      onRenameWorkspace(nameInput.trim());
    }
    setIsRenaming(false);
  };

  return (
    <header className="absolute top-4 left-4 right-4 h-13 px-4 bg-[#0d121f]/90 border border-slate-800/80 rounded-xl backdrop-blur-xl flex items-center justify-between z-10 shadow-lg pointer-events-auto">
      {/* Left: Workspace Title & Inline Rename */}
      <div className="flex items-center gap-3">
        {isRenaming ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRename();
                if (e.key === 'Escape') setIsRenaming(false);
              }}
              autoFocus
              className="bg-slate-900 border border-indigo-500 rounded px-2.5 py-1 text-sm text-slate-100 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveRename}
              className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsRenaming(false)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <h1 className="text-sm font-semibold text-slate-100 tracking-tight">
              {workspace?.name || 'Workspace Graph'}
            </h1>
            <button
              type="button"
              title="Rename workspace"
              onClick={handleStartRename}
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-500 hover:text-slate-300 transition-opacity"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-800 text-xs text-slate-400">
          <span>{nodeCount} nodes</span>
          <span className="text-slate-600">•</span>
          <span>{connectionCount} connections</span>
        </div>
      </div>

      {/* Center: Persistence Status Indicator */}
      <div className="flex items-center gap-2">
        {saveStatus === 'saving' && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-medium animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Saving...</span>
          </div>
        )}
        {saveStatus === 'saved' && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <CheckCircle2 className="w-3 h-3" />
            <span>All changes saved</span>
          </div>
        )}
        {saveStatus === 'error' && (
          <button
            type="button"
            onClick={onRetrySave}
            title="Click to retry saving"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs font-medium transition-colors"
          >
            <AlertCircle className="w-3 h-3" />
            <span>Save failed (Retry)</span>
          </button>
        )}
      </div>

      {/* Right: Quick Action Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          title="Add Node"
          onClick={onAddNode}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all mr-2"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Add Node</span>
        </button>

        <div className="flex items-center border border-slate-800 rounded-lg p-0.5 bg-slate-900/60">
          <button
            type="button"
            title="Undo (Ctrl+Z)"
            disabled={!canUndo}
            onClick={onUndo}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Redo (Ctrl+Y)"
            disabled={!canRedo}
            onClick={onRedo}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center border border-slate-800 rounded-lg p-0.5 bg-slate-900/60">
          <button
            type="button"
            title="Fit to view"
            onClick={onFitView}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Zoom In"
            onClick={onZoomIn}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Zoom Out"
            onClick={onZoomOut}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title={showMinimap ? 'Hide Minimap' : 'Show Minimap'}
            onClick={onToggleMinimap}
            className={`p-1.5 rounded transition-colors ${
              showMinimap ? 'text-indigo-400 bg-indigo-950/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
