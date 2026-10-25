import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Star, Plus, Copy, Trash2, Tag, ArrowUpRight } from 'lucide-react';
import type { KnowledgeNode } from '../types';

export interface KnowledgeNodeData extends KnowledgeNode {
  [key: string]: unknown;
  onToggleFavorite?: (id: string, isFav: boolean) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddChildNode?: (id: string) => void;
  onSelectNode?: (id: string) => void;
  isSearchMatch?: boolean;
}

const COLOR_MAP: Record<string, { bg: string; border: string; glow: string; text: string }> = {
  '#ec4899': { bg: 'bg-pink-50', border: 'border-pink-300', glow: 'shadow-pink-500/15', text: 'text-pink-600' },
  '#f43f5e': { bg: 'bg-rose-50', border: 'border-rose-300', glow: 'shadow-rose-500/15', text: 'text-rose-600' },
  '#fb7185': { bg: 'bg-pink-50', border: 'border-pink-200', glow: 'shadow-pink-400/15', text: 'text-pink-500' },
  '#d946ef': { bg: 'bg-fuchsia-50', border: 'border-fuchsia-300', glow: 'shadow-fuchsia-500/15', text: 'text-fuchsia-600' },
  '#be185d': { bg: 'bg-pink-100', border: 'border-pink-400', glow: 'shadow-pink-600/15', text: 'text-pink-700' },
  '#6366f1': { bg: 'bg-indigo-50', border: 'border-indigo-300', glow: 'shadow-indigo-500/15', text: 'text-indigo-600' },
  '#10b981': { bg: 'bg-emerald-50', border: 'border-emerald-300', glow: 'shadow-emerald-500/15', text: 'text-emerald-600' },
  '#1e293b': { bg: 'bg-pink-50', border: 'border-pink-300', glow: 'shadow-pink-500/15', text: 'text-pink-600' },
};

export const KnowledgeNodeComponent = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as KnowledgeNodeData;
  const colorTheme = COLOR_MAP[nodeData.color || '#ec4899'] || COLOR_MAP['#ec4899'];

  return (
    <div
      onClick={() => nodeData.onSelectNode?.(id)}
      className={`group relative rounded-2xl border transition-all duration-200 select-none cursor-pointer
        ${selected ? 'ring-2 ring-pink-500 border-pink-500 shadow-xl shadow-pink-500/20' : `${colorTheme.border} hover:border-pink-400`}
        ${nodeData.isSearchMatch ? 'ring-2 ring-pink-500 border-pink-500 shadow-xl shadow-pink-500/25 scale-105' : ''}
        bg-white/95 backdrop-blur-md shadow-md min-w-[240px] max-w-[300px] overflow-visible`}
    >
      {/* 4 Connection Handles for omnidirectional connections */}
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        className="!w-3 !h-3 !-top-1.5 !bg-pink-500 !border-2 !border-white hover:!scale-125 transition-transform !shadow-sm"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top-source"
        className="!w-3 !h-3 !-top-1.5 !bg-pink-500 !border-2 !border-white opacity-0"
      />

      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className="!w-3 !h-3 !-right-1.5 !bg-pink-500 !border-2 !border-white hover:!scale-125 transition-transform !shadow-sm"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="!w-3 !h-3 !-right-1.5 !bg-pink-500 !border-2 !border-white opacity-0"
      />

      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-target"
        className="!w-3 !h-3 !-bottom-1.5 !bg-pink-500 !border-2 !border-white hover:!scale-125 transition-transform !shadow-sm"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-source"
        className="!w-3 !h-3 !-bottom-1.5 !bg-pink-500 !border-2 !border-white opacity-0"
      />

      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="!w-3 !h-3 !-left-1.5 !bg-pink-500 !border-2 !border-white hover:!scale-125 transition-transform !shadow-sm"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        className="!w-3 !h-3 !-left-1.5 !bg-pink-500 !border-2 !border-white opacity-0"
      />

      {/* Node Header Accent Stripe */}
      <div
        className="h-2 w-full rounded-t-2xl"
        style={{ backgroundColor: nodeData.color && nodeData.color !== '#1e293b' ? nodeData.color : '#ec4899' }}
      />

      {/* Node Content Container */}
      <div className="p-4 space-y-2.5">
        {/* Title & Favorite Action */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm text-slate-800 line-clamp-1 flex-1 tracking-tight">
            {nodeData.title || 'Untitled Node'}
          </h3>
          <button
            type="button"
            title={nodeData.is_favorite ? 'Remove favorite' : 'Add to favorites'}
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onToggleFavorite?.(id, !nodeData.is_favorite);
            }}
            className={`p-1 rounded-md hover:bg-pink-50 transition-colors ${
              nodeData.is_favorite ? 'text-pink-500' : 'text-slate-300 hover:text-pink-400'
            }`}
          >
            <Star className="w-4 h-4" fill={nodeData.is_favorite ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Content Preview */}
        {nodeData.content ? (
          <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed font-normal">
            {nodeData.content}
          </p>
        ) : (
          <p className="text-xs text-pink-300 italic">No notes written...</p>
        )}

        {/* Tags */}
        {nodeData.tags && nodeData.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {nodeData.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pink-50 text-pink-600 border border-pink-200"
              >
                <Tag className="w-2.5 h-2.5 text-pink-500" />
                {tag}
              </span>
            ))}
            {nodeData.tags.length > 3 && (
              <span className="text-[10px] text-pink-400 font-medium self-center">
                +{nodeData.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Floating Quick Action Bar on Hover or Selection */}
      <div
        className={`absolute -bottom-9 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2.5 py-1 bg-white/95 border border-pink-200 rounded-full shadow-lg shadow-pink-500/10 transition-all duration-150 z-20 ${
          selected ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto'
        }`}
      >
        <button
          type="button"
          title="Create connected node"
          onClick={(e) => {
            e.stopPropagation();
            nodeData.onAddChildNode?.(id);
          }}
          className="p-1.5 rounded-full text-pink-600 hover:bg-pink-50 hover:text-pink-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Duplicate node"
          onClick={(e) => {
            e.stopPropagation();
            nodeData.onDuplicate?.(id);
          }}
          className="p-1.5 rounded-full text-slate-500 hover:text-pink-600 hover:bg-pink-50 transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Delete node"
          onClick={(e) => {
            e.stopPropagation();
            nodeData.onDelete?.(id);
          }}
          className="p-1.5 rounded-full text-rose-500 hover:bg-rose-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Open detail panel"
          onClick={(e) => {
            e.stopPropagation();
            nodeData.onSelectNode?.(id);
          }}
          className="p-1.5 rounded-full text-slate-500 hover:text-pink-600 hover:bg-pink-50 transition-colors"
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});

KnowledgeNodeComponent.displayName = 'KnowledgeNodeComponent';
