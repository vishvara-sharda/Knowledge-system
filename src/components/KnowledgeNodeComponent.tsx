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
  '#6366f1': { bg: 'bg-indigo-500/10', border: 'border-indigo-500/50', glow: 'shadow-indigo-500/20', text: 'text-indigo-400' },
  '#3b82f6': { bg: 'bg-blue-500/10', border: 'border-blue-500/50', glow: 'shadow-blue-500/20', text: 'text-blue-400' },
  '#10b981': { bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', glow: 'shadow-emerald-500/20', text: 'text-emerald-400' },
  '#f59e0b': { bg: 'bg-amber-500/10', border: 'border-amber-500/50', glow: 'shadow-amber-500/20', text: 'text-amber-400' },
  '#ec4899': { bg: 'bg-pink-500/10', border: 'border-pink-500/50', glow: 'shadow-pink-500/20', text: 'text-pink-400' },
  '#8b5cf6': { bg: 'bg-purple-500/10', border: 'border-purple-500/50', glow: 'shadow-purple-500/20', text: 'text-purple-400' },
  '#1e293b': { bg: 'bg-slate-800/80', border: 'border-slate-700', glow: 'shadow-black/30', text: 'text-slate-400' },
};

export const KnowledgeNodeComponent = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as KnowledgeNodeData;
  const colorTheme = COLOR_MAP[nodeData.color || '#1e293b'] || COLOR_MAP['#1e293b'];

  return (
    <div
      onClick={() => nodeData.onSelectNode?.(id)}
      className={`group relative rounded-xl border transition-all duration-200 select-none cursor-pointer
        ${selected ? 'ring-2 ring-indigo-400 border-indigo-400 shadow-lg shadow-indigo-500/30' : colorTheme.border}
        ${nodeData.isSearchMatch ? 'ring-2 ring-yellow-400 border-yellow-400 shadow-lg shadow-yellow-500/30 scale-105' : ''}
        bg-[#111726]/95 backdrop-blur-md shadow-md min-w-[240px] max-w-[300px] overflow-visible`}
    >
      {/* 4 Connection Handles for omnidirectional connections */}
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        className="!w-3 !h-3 !-top-1.5 !bg-indigo-400 !border-2 !border-slate-900 hover:!scale-125 transition-transform"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top-source"
        className="!w-3 !h-3 !-top-1.5 !bg-indigo-400 !border-2 !border-slate-900 opacity-0"
      />

      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className="!w-3 !h-3 !-right-1.5 !bg-indigo-400 !border-2 !border-slate-900 hover:!scale-125 transition-transform"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="!w-3 !h-3 !-right-1.5 !bg-indigo-400 !border-2 !border-slate-900 opacity-0"
      />

      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-target"
        className="!w-3 !h-3 !-bottom-1.5 !bg-indigo-400 !border-2 !border-slate-900 hover:!scale-125 transition-transform"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-source"
        className="!w-3 !h-3 !-bottom-1.5 !bg-indigo-400 !border-2 !border-slate-900 opacity-0"
      />

      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="!w-3 !h-3 !-left-1.5 !bg-indigo-400 !border-2 !border-slate-900 hover:!scale-125 transition-transform"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        className="!w-3 !h-3 !-left-1.5 !bg-indigo-400 !border-2 !border-slate-900 opacity-0"
      />

      {/* Node Header Accent Stripe */}
      <div
        className="h-1.5 w-full rounded-t-xl"
        style={{ backgroundColor: nodeData.color || '#6366f1' }}
      />

      {/* Node Content Container */}
      <div className="p-3.5 space-y-2">
        {/* Title & Favorite Action */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm text-slate-100 line-clamp-1 flex-1 tracking-tight">
            {nodeData.title || 'Untitled Node'}
          </h3>
          <button
            type="button"
            title={nodeData.is_favorite ? 'Remove favorite' : 'Add to favorites'}
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onToggleFavorite?.(id, !nodeData.is_favorite);
            }}
            className={`p-1 rounded hover:bg-slate-800 transition-colors ${
              nodeData.is_favorite ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Star className="w-3.5 h-3.5" fill={nodeData.is_favorite ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Content Preview */}
        {nodeData.content ? (
          <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed font-normal">
            {nodeData.content}
          </p>
        ) : (
          <p className="text-xs text-slate-600 italic">No notes written...</p>
        )}

        {/* Tags */}
        {nodeData.tags && nodeData.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {nodeData.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-800/90 text-slate-300 border border-slate-700/60"
              >
                <Tag className="w-2.5 h-2.5 text-indigo-400" />
                {tag}
              </span>
            ))}
            {nodeData.tags.length > 3 && (
              <span className="text-[10px] text-slate-500 self-center">
                +{nodeData.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Floating Quick Action Bar on Hover or Selection */}
      <div
        className={`absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 bg-slate-900/95 border border-slate-700 rounded-full shadow-lg transition-all duration-150 z-20 ${
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
          className="p-1 rounded-full text-indigo-400 hover:bg-indigo-950/60 transition-colors"
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
          className="p-1 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
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
          className="p-1 rounded-full text-rose-400 hover:bg-rose-950/60 transition-colors"
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
          className="p-1 rounded-full text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors"
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});

KnowledgeNodeComponent.displayName = 'KnowledgeNodeComponent';
