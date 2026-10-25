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
    <header className="absolute top-4 left-4 right-4 h-14 px-4 bg-white/90 border border-pink-100 rounded-2xl backdrop-blur-xl flex items-center justify-between z-10 shadow-md shadow-pink-500/5 pointer-events-auto font-sans">
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
              className="bg-pink-50/50 border border-pink-500 rounded-xl px-3 py-1.5 text-sm text-slate-800 font-semibold focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveRename}
              className="p-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsRenaming(false)}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <h1 className="text-sm font-bold text-slate-800 tracking-tight">
              {workspace?.name || 'Workspace Graph'}
            </h1>
            <button
              type="button"
              title="Rename workspace"
              onClick={handleStartRename}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-pink-400 hover:text-pink-600 transition-opacity"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-pink-100 text-xs font-medium text-slate-400">
          <span className="text-pink-600 font-semibold">{nodeCount} nodes</span>
          <span className="text-pink-200">•</span>
          <span className="text-pink-600 font-semibold">{connectionCount} connections</span>
        </div>
      </div>

      {/* Center: Persistence Status Indicator */}
      <div className="flex items-center gap-2">
        {saveStatus === 'saving' && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-100 border border-pink-300 text-pink-700 text-xs font-semibold animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin text-pink-600" />
            <span>Saving...</span>
          </div>
        )}
        {saveStatus === 'saved' && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-50 border border-pink-200 text-pink-700 text-xs font-semibold shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-pink-600" />
            <span>All changes saved</span>
          </div>
        )}
        {saveStatus === 'error' && (
          <button
            type="button"
            onClick={onRetrySave}
            title="Click to retry saving"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 text-xs font-semibold transition-colors"
          >
            <AlertCircle className="w-3.5 h-3.5" />
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
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-xs font-bold shadow-md shadow-pink-300/40 hover:shadow-pink-400 transition-all mr-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden md:inline">Add Node</span>
        </button>

        <div className="flex items-center border border-pink-100 rounded-xl p-0.5 bg-white shadow-xs">
          <button
            type="button"
            title="Undo (Ctrl+Z)"
            disabled={!canUndo}
            onClick={onUndo}
            className="p-1.5 rounded-lg text-slate-400 hover:text-pink-600 hover:bg-pink-50 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:bg-transparent transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Redo (Ctrl+Y)"
            disabled={!canRedo}
            onClick={onRedo}
            className="p-1.5 rounded-lg text-slate-400 hover:text-pink-600 hover:bg-pink-50 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:bg-transparent transition-colors"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center border border-pink-100 rounded-xl p-0.5 bg-white shadow-xs">
          <button
            type="button"
            title="Fit to view"
            onClick={onFitView}
            className="p-1.5 rounded-lg text-slate-400 hover:text-pink-600 hover:bg-pink-50 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Zoom In"
            onClick={onZoomIn}
            className="p-1.5 rounded-lg text-slate-400 hover:text-pink-600 hover:bg-pink-50 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Zoom Out"
            onClick={onZoomOut}
            className="p-1.5 rounded-lg text-slate-400 hover:text-pink-600 hover:bg-pink-50 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title={showMinimap ? 'Hide Minimap' : 'Show Minimap'}
            onClick={onToggleMinimap}
            className={`p-1.5 rounded-lg transition-colors ${
              showMinimap ? 'text-pink-600 bg-pink-100 font-bold' : 'text-slate-400 hover:text-pink-600 hover:bg-pink-50'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
