import React, { useEffect, useRef } from 'react';
import { Plus, Maximize2, Map, Copy, Trash2, Star } from 'lucide-react';

export interface ContextMenuState {
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
  nodeId?: string;
}

interface ContextMenuProps {
  menu: ContextMenuState | null;
  onClose: () => void;
  onCreateNodeAt: (canvasX: number, canvasY: number) => void;
  onFitView: () => void;
  onToggleMinimap: () => void;
  onDuplicateNode?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onAddChildNode?: (nodeId: string) => void;
  onToggleFavorite?: (nodeId: string) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  menu,
  onClose,
  onCreateNodeAt,
  onFitView,
  onToggleMinimap,
  onDuplicateNode,
  onDeleteNode,
  onAddChildNode,
  onToggleFavorite,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('contextmenu', handleOutsideClick);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('contextmenu', handleOutsideClick);
    };
  }, [onClose]);

  if (!menu) return null;

  return (
    <div
      ref={menuRef}
      style={{ top: menu.y, left: menu.x }}
      className="fixed z-50 min-w-[180px] bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl p-1.5 backdrop-blur-xl animate-in fade-in duration-100"
    >
      {menu.nodeId ? (
        // Node Context Menu
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => {
              onAddChildNode?.(menu.nodeId!);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:bg-indigo-600/20 hover:text-indigo-300 transition-colors text-left"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-400" />
            <span>Add Connected Node</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onDuplicateNode?.(menu.nodeId!);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors text-left"
          >
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span>Duplicate Node</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onToggleFavorite?.(menu.nodeId!);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors text-left"
          >
            <Star className="w-3.5 h-3.5 text-amber-400" />
            <span>Toggle Favorite</span>
          </button>
          <div className="h-px bg-slate-800 my-1" />
          <button
            type="button"
            onClick={() => {
              onDeleteNode?.(menu.nodeId!);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-950/40 transition-colors text-left"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Node</span>
          </button>
        </div>
      ) : (
        // Canvas Context Menu
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => {
              onCreateNodeAt(menu.canvasX, menu.canvasY);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:bg-indigo-600/20 hover:text-indigo-300 transition-colors text-left"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-400" />
            <span>Create Node Here</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onFitView();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors text-left"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Fit All to View</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onToggleMinimap();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors text-left"
          >
            <Map className="w-3.5 h-3.5 text-slate-400" />
            <span>Toggle Minimap</span>
          </button>
        </div>
      )}
    </div>
  );
};
