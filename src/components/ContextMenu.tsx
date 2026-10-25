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
      className="fixed z-50 min-w-[190px] bg-white/98 border border-pink-100 rounded-2xl shadow-xl shadow-pink-500/10 p-1.5 backdrop-blur-xl animate-in fade-in duration-100 font-sans"
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
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-pink-50 hover:text-pink-600 transition-colors text-left"
          >
            <Plus className="w-3.5 h-3.5 text-pink-500" />
            <span>Add Connected Node</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onDuplicateNode?.(menu.nodeId!);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-pink-50 hover:text-pink-600 transition-colors text-left"
          >
            <Copy className="w-3.5 h-3.5 text-pink-400" />
            <span>Duplicate Node</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onToggleFavorite?.(menu.nodeId!);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-pink-50 hover:text-pink-600 transition-colors text-left"
          >
            <Star className="w-3.5 h-3.5 text-pink-500" />
            <span>Toggle Favorite</span>
          </button>
          <div className="h-px bg-pink-100 my-1" />
          <button
            type="button"
            onClick={() => {
              onDeleteNode?.(menu.nodeId!);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors text-left"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
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
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-pink-50 hover:text-pink-600 transition-colors text-left"
          >
            <Plus className="w-3.5 h-3.5 text-pink-500" />
            <span>Create Node Here</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onFitView();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-pink-50 hover:text-pink-600 transition-colors text-left"
          >
            <Maximize2 className="w-3.5 h-3.5 text-pink-400" />
            <span>Fit All to View</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onToggleMinimap();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-pink-50 hover:text-pink-600 transition-colors text-left"
          >
            <Map className="w-3.5 h-3.5 text-pink-400" />
            <span>Toggle Minimap</span>
          </button>
        </div>
      )}
    </div>
  );
};
