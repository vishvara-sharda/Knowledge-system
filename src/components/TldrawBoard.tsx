import { useEffect, useState, useRef, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import {
  Tldraw,
  useEditor,
  useValue,
  type Editor,
  type TLComponents,
  type TLGridProps,
} from 'tldraw';
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  Rectangle2d,
  T,
  type TLBaseShape,
} from '@tldraw/editor';
import { createShapeId } from '@tldraw/tlschema';
import 'tldraw/tldraw.css';
import { LiquidGlassButton } from '../design-system';
import { DatabaseStatusBadge } from './DatabaseStatusBadge';

interface TldrawBoardProps {
  cardId?: string;
  cardTitle: string;
  cardColor?: string;
  onBack: () => void;
}

export interface CollapsedNodeData {
  childShapes: any[];
  arrows: any[];
  bindings: any[];
  anchor: { x: number; y: number };
}

/**
 * Main Node Shape Type definition
 */
export type MainNodeShape = TLBaseShape<
  'main-node',
  {
    w: number;
    h: number;
    title: string;
    date: string;
    color: string;
    isCollapsed?: boolean;
    collapsedCount?: number;
    collapsedData?: CollapsedNodeData;
  }
>;

/**
 * Fixed height for the Main Node container:
 * 16px top padding + ~19px heading + 4px gap + ~13px date + 16px bottom padding = 68px
 */
export const MAIN_NODE_HEIGHT = 68;

/**
 * Link Item representation inside a Link Node
 */
export interface LinkItem {
  id: string;
  url: string;
  type: 'linkedin' | 'website' | 'empty';
}

/**
 * Link Node Shape Type definition
 */
export type LinkNodeShape = TLBaseShape<
  'link-node',
  {
    w: number;
    h: number;
    mainNodeId?: string;
    links: LinkItem[];
  }
>;

export const LINK_NODE_WIDTH = 340;

/**
 * Person Node Shape Type definition:
 * Represents a profile/person node with Name input, About input, and Link inputs
 */
export type PersonNodeShape = TLBaseShape<
  'person-node',
  {
    w: number;
    h: number;
    mainNodeId?: string;
    name: string;
    about: string;
    links: LinkItem[];
  }
>;

export const PERSON_NODE_WIDTH = 340;

export function computePersonNodeHeight(linksCount: number): number {
  const count = Math.max(1, linksCount);
  return 154 + count * 44;
}

export interface NoteStroke {
  id: string;
  color: string;
  size: number;
  thickness: number;
  dash: string;
  fill: string;
  points: Array<{ x: number; y: number }>;
}

export const COLOR_HEX_MAP: Record<string, string> = {
  black: '#1d1d1d',
  red: '#e03131',
  blue: '#2f80ed',
  green: '#099268',
};

export function pointsToSvgPath(points: Array<{ x: number; y: number }>, _thickness: number = 3): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
  }

  // Smooth quadratic bezier curve
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y}, ${xc} ${yc}`;
  }
  d += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  return d;
}

/**
 * Note Node Shape Type definition:
 * A resizable lined notebook page attached to a main node
 */
export type NoteNodeShape = TLBaseShape<
  'note-node',
  {
    w: number;
    h: number;
    mainNodeId?: string;
    title: string;
    content: string;
    color?: string;
    drawings?: NoteStroke[];
    innerShapes?: any[];
    isExpanded?: boolean;
  }
>;

export const DEFAULT_NOTE_WIDTH = 280;
export const DEFAULT_NOTE_HEIGHT = 300;
export const MIN_NOTE_WIDTH = 180;
export const MIN_NOTE_HEIGHT = 160;

/**
 * Simple Note Node Shape Type definition:
 * A simple typable notebook page with fixed width & height and ruled notebook lines
 */
export type SimpleNoteNodeShape = TLBaseShape<
  'simple-note-node',
  {
    w: number;
    h: number;
    mainNodeId?: string;
    title: string;
    content: string;
    color?: string;
    isExpanded?: boolean;
    simpleNote?: boolean;
  }
>;

export const SIMPLE_NOTE_WIDTH = 300;
export const SIMPLE_NOTE_HEIGHT = 330;
export const SIMPLE_NOTE_EXPANDED_WIDTH = 420;
export const SIMPLE_NOTE_EXPANDED_HEIGHT = 480;

/**
 * Automatically detects whether a given URL is LinkedIn or a general Website
 */
export function detectLinkType(url: string): 'linkedin' | 'website' | 'empty' {
  const trimmed = url.trim();
  if (!trimmed) return 'empty';
  const lower = trimmed.toLowerCase();
  if (lower.includes('linkedin.com') || lower.includes('linked.in')) {
    return 'linkedin';
  }
  return 'website';
}

/**
 * Formats a clean display title and subtitle from a URL
 */
export function getLinkDisplayInfo(url: string, type: 'linkedin' | 'website' | 'empty') {
  const trimmed = url.trim();
  if (!trimmed) {
    return { label: 'Empty Link', sublabel: 'Click to enter link', href: '' };
  }
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  if (type === 'linkedin') {
    try {
      const u = new URL(href);
      const parts = u.pathname.split('/').filter(Boolean);
      const username = parts.length > 0 ? parts[parts.length - 1] : '';
      return {
        label: username ? `LinkedIn / ${username}` : 'LinkedIn Profile',
        sublabel: u.hostname + (u.pathname !== '/' ? u.pathname : ''),
        href,
      };
    } catch {
      return { label: 'LinkedIn Profile', sublabel: trimmed, href };
    }
  }

  // Website
  try {
    const u = new URL(href);
    const domain = u.hostname.replace(/^www\./, '');
    return {
      label: domain,
      sublabel: u.pathname !== '/' && u.pathname !== '' ? u.pathname : 'Website',
      href,
    };
  } catch {
    return { label: trimmed, sublabel: 'Website', href };
  }
}

/**
 * Computes dynamic height of Link Node based on number of link items:
 * Top padding (12px) + links (count * 38px) + link gaps ((count - 1) * 8px) + gap to plus (8px) + plus button (24px) + bottom padding (12px)
 * = 46 * count + 48
 */
export function computeLinkNodeHeight(linksCount: number): number {
  const count = Math.max(1, linksCount);
  return 46 * count + 62;
}

/**
 * Cached canvas 2D context for accurate text measurement
 */
let measureCtx: CanvasRenderingContext2D | null = null;

function measureTextWidth(text: string, font: string): number {
  if (typeof window === 'undefined') return text.length * 9.2;
  if (!measureCtx) {
    const canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d');
  }
  if (!measureCtx) return text.length * 9.2;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

/**
 * Computes the dynamic width of the container strictly according to heading length
 * with 16px padding on both sides (32px total horizontal padding).
 */
export function computeMainNodeWidth(
  title: string,
  date: string,
  isCollapsed = false,
  collapsedCount = 0
): number {
  const safeTitle = title.trim() || 'Main Node';
  const titleW = measureTextWidth(safeTitle, '700 15px Manrope, sans-serif');
  const dateW = measureTextWidth(date || '', '500 11px Manrope, sans-serif');
  const maxContentW = Math.max(titleW, dateW);
  const extraBadgeW = isCollapsed && collapsedCount > 0 ? 38 : 0;
  // 16px left + 16px right + 4px breathing room + optional collapsed badge
  return Math.ceil(maxContentW + 36 + extraBadgeW);
}

/**
 * Finds a collision-free position for a new node on the canvas so it never overlaps existing shapes.
 * - For child nodes (link-node, note-node), attempts downward stacking with clean spacing.
 * - If obstacles exist or downward stack exceeds bounds, shifts horizontally or searches outward in radial rings.
 */
export function findNonOverlappingPosition(
  editor: Editor,
  preferred: { x: number; y: number; w: number; h: number },
  options?: {
    preferredDirection?: 'down' | 'spiral';
    margin?: number;
    excludeShapeIds?: string[];
  }
): { x: number; y: number } {
  const margin = options?.margin ?? 32;
  const excludeSet = new Set(options?.excludeShapeIds || []);

  // Retrieve all existing non-arrow, non-group shapes
  const allShapes = editor.getCurrentPageShapes().filter(
    (s) => s.type !== 'arrow' && s.type !== 'group' && !excludeSet.has(s.id)
  );

  const collidesWithAny = (box: { x: number; y: number; w: number; h: number }) => {
    for (const s of allShapes) {
      const bounds = editor.getShapePageBounds(s.id);
      const sBox = bounds
        ? { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h }
        : {
            x: s.x,
            y: s.y,
            w: (s.props as any)?.w || 200,
            h: (s.props as any)?.h || 80,
          };

      const overlap = !(
        box.x + box.w + margin <= sBox.x ||
        box.x >= sBox.x + sBox.w + margin ||
        box.y + box.h + margin <= sBox.y ||
        box.y >= sBox.y + sBox.h + margin
      );
      if (overlap) return true;
    }
    return false;
  };

  // If the initial preferred position is completely clear, use it immediately
  if (!collidesWithAny(preferred)) {
    return { x: preferred.x, y: preferred.y };
  }

  // 1. If preferred direction is downward (natural for linked/note children branching to the right)
  if (options?.preferredDirection === 'down') {
    let currX = preferred.x;
    let currY = preferred.y;
    for (let i = 0; i < 50; i++) {
      currY += 28;
      if (!collidesWithAny({ x: currX, y: currY, w: preferred.w, h: preferred.h })) {
        return { x: currX, y: currY };
      }
      // If column reaches too far down (> 1100px from starting Y), advance to a new column on the right
      if (currY - preferred.y > 1100) {
        currX += preferred.w + margin + 32;
        currY = preferred.y;
      }
    }
  }

  // 2. Radial spiral grid search outward from preferred center
  const stepX = preferred.w + margin;
  const stepY = preferred.h + margin;

  for (let ring = 1; ring <= 15; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        // Only inspect points on the outer boundary of the current ring
        if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;

        const candidateX = preferred.x + dx * stepX;
        const candidateY = preferred.y + dy * stepY;

        if (!collidesWithAny({ x: candidateX, y: candidateY, w: preferred.w, h: preferred.h })) {
          return { x: candidateX, y: candidateY };
        }
      }
    }
  }

  return { x: preferred.x + stepX, y: preferred.y + stepY };
}

/**
 * Resolves all child nodes (link-node, note-node, person-node) and connecting arrows
 * linked to a given main-node via:
 * 1. Explicit props.mainNodeId === mainNodeId
 * 2. Arrows pointing to/from the main node (via meta, props bindings, or record store bindings)
 * 3. Fallback: if there's only 1 main node on canvas, all child shapes belong to it
 */
export function getConnectedChildrenAndArrows(editor: Editor, mainNodeId: string) {
  const allShapes = editor.getCurrentPageShapes();
  const allBindings =
    ((editor.store as any).query?.records?.('binding')?.get?.() || []) as any[];

  // 1. Gather all arrows directly connected to this main node
  const connectedArrowIds = new Set<string>();
  for (const s of allShapes) {
    if (s.type === 'arrow') {
      const metaStart = (s.meta as any)?.startNodeId;
      const metaEnd = (s.meta as any)?.endNodeId;
      const boundStart = (s.props as any)?.start?.boundShapeId;
      const boundEnd = (s.props as any)?.end?.boundShapeId;
      if (
        metaStart === mainNodeId ||
        metaEnd === mainNodeId ||
        boundStart === mainNodeId ||
        boundEnd === mainNodeId
      ) {
        connectedArrowIds.add(s.id);
      }
    }
  }

  // Check bindings in record store for arrows connected to main node
  for (const b of allBindings) {
    if (b.type === 'arrow' && b.toId === mainNodeId) {
      connectedArrowIds.add(b.fromId);
    }
  }

  // 2. Find all child nodes connected either via mainNodeId OR via connected arrows
  const connectedChildIds = new Set<string>();

  // Check via connected arrows
  for (const arrowId of connectedArrowIds) {
    const arrow = editor.getShape(arrowId as any);
    if (arrow && arrow.type === 'arrow') {
      const metaStart = (arrow.meta as any)?.startNodeId;
      const metaEnd = (arrow.meta as any)?.endNodeId;
      const boundStart = (arrow.props as any)?.start?.boundShapeId;
      const boundEnd = (arrow.props as any)?.end?.boundShapeId;
      [metaStart, metaEnd, boundStart, boundEnd].forEach((id) => {
        if (id && id !== mainNodeId) {
          const target = editor.getShape(id as any);
          if (target && (target as any).type !== 'main-node' && (target as any).type !== 'arrow') {
            connectedChildIds.add(id);
          }
        }
      });
    }
  }

  for (const b of allBindings) {
    if (b.type === 'arrow' && connectedArrowIds.has(b.fromId) && b.toId !== mainNodeId) {
      const target = editor.getShape(b.toId as any);
      if (target && (target as any).type !== 'main-node' && (target as any).type !== 'arrow') {
        connectedChildIds.add(b.toId);
      }
    }
  }

  // Check via props.mainNodeId
  for (const s of allShapes) {
    const sType = (s as any).type;
    if (
      (sType === 'link-node' || sType === 'note-node' || sType === 'simple-note-node' || sType === 'person-node') &&
      (s.props as any)?.mainNodeId === mainNodeId
    ) {
      connectedChildIds.add(s.id);
    }
  }

  // Fallback: If only 1 main node exists on the canvas and we have child nodes, all of them belong to this flowchart!
  const allMainNodes = allShapes.filter((s: any) => s.type === 'main-node');
  if (allMainNodes.length === 1 && connectedChildIds.size === 0) {
    for (const s of allShapes) {
      const sType = (s as any).type;
      if (sType === 'link-node' || sType === 'note-node' || sType === 'simple-note-node' || sType === 'person-node') {
        connectedChildIds.add(s.id);
      }
      if (s.type === 'arrow') {
        connectedArrowIds.add(s.id);
      }
    }
  }

  // Also include any arrows between or to these child nodes
  for (const s of allShapes) {
    if (s.type === 'arrow') {
      const metaStart = (s.meta as any)?.startNodeId;
      const metaEnd = (s.meta as any)?.endNodeId;
      const boundStart = (s.props as any)?.start?.boundShapeId;
      const boundEnd = (s.props as any)?.end?.boundShapeId;
      if (
        connectedChildIds.has(metaStart) ||
        connectedChildIds.has(metaEnd) ||
        connectedChildIds.has(boundStart) ||
        connectedChildIds.has(boundEnd)
      ) {
        connectedArrowIds.add(s.id);
      }
    }
  }

  for (const b of allBindings) {
    if (b.type === 'arrow' && connectedChildIds.has(b.toId)) {
      connectedArrowIds.add(b.fromId);
    }
  }

  const childShapes = Array.from(connectedChildIds)
    .map((id) => editor.getShape(id as any))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const arrowShapes = Array.from(connectedArrowIds)
    .map((id) => editor.getShape(id as any))
    .filter((s) => s && s.type === 'arrow');

  const relevantBindings = allBindings.filter(
    (b: any) =>
      connectedArrowIds.has(b.fromId) ||
      connectedChildIds.has(b.toId) ||
      b.toId === mainNodeId
  );

  return {
    childShapes,
    arrowShapes,
    relevantBindings,
    childIds: connectedChildIds,
    arrowIds: connectedArrowIds,
  };
}

/**
 * React Component for the Main Node shape rendered on the Tldraw canvas.
 * - Dynamic width determined automatically by heading length
 * - Fixed height (68px)
 * - Exact 16px padding from all sides
 * - Date created stacked directly under the heading
 * - Hover state and drag state with signature multi-ring glass gradient boundary
 * - Single click collapses/folds all connected child nodes into the main node; click again expands them
 */
function MainNodeComponent({ shape }: { shape: MainNodeShape }) {
  const editor = useEditor();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPointerDragging, setIsPointerDragging] = useState(false);
  const [title, setTitle] = useState(shape.props.title || 'Main Node');

  const hasMovedRef = useRef(false);
  const downPointRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastToggleRef = useRef(0);

  // Reactively track if this shape is currently being translated (dragged) in tldraw
  const isTranslating = useValue(
    'is-translating',
    () => {
      const isSelected = editor.getSelectedShapeIds().includes(shape.id);
      if (!isSelected) return false;
      const path = editor.getPath();
      return (
        path.includes('translating') ||
        path.includes('dragging') ||
        editor.inputs.getIsDragging()
      );
    },
    [editor, shape.id]
  );

  // Hover state is active on mouse hover OR when actively being dragged across the canvas
  const isDragging = isTranslating || isPointerDragging;
  const isHoverStateActive = isHovered || isDragging;

  const isDraggingRef = useRef(false);
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  // Folds/collapses or expands all child nodes and connecting arrows connected to this main node
  const handleToggleCollapse = useCallback(() => {
    const isCurrentlyCollapsed = shape.props.isCollapsed ?? false;

    if (isCurrentlyCollapsed) {
      // EXPAND: restore saved child shapes and arrows with position adjustment
      const data = shape.props.collapsedData;
      if (data && Array.isArray(data.childShapes)) {
        const anchor = data.anchor || { x: shape.x, y: shape.y };
        const dx = shape.x - anchor.x;
        const dy = shape.y - anchor.y;

        const restoredChildren = (data.childShapes || []).map((s: any) => ({
          ...s,
          x: s.x + dx,
          y: s.y + dy,
        }));

        const restoredArrows = (data.arrows || []).map((a: any) => ({
          ...a,
          x: (a.x ?? 0) + dx,
          y: (a.y ?? 0) + dy,
        }));

        if (restoredChildren.length > 0) {
          editor.createShapes(restoredChildren);
        }
        if (restoredArrows.length > 0) {
          editor.createShapes(restoredArrows);
        }

        if (Array.isArray(data.bindings) && data.bindings.length > 0) {
          try {
            editor.createBindings(data.bindings);
          } catch {
            // ignore
          }
        }
      }

      const safeTitle = shape.props.title || title;
      const newWidth = computeMainNodeWidth(safeTitle, shape.props.date, false, 0);

      (editor as any).updateShape({
        id: shape.id,
        type: 'main-node',
        props: {
          ...shape.props,
          w: newWidth,
          isCollapsed: false,
          collapsedCount: 0,
          collapsedData: undefined,
        },
      });
      editor.select(shape.id);
    } else {
      // COLLAPSE: gather child shapes and connecting arrows, save, and delete from canvas
      const { childShapes, arrowShapes, relevantBindings, childIds, arrowIds } =
        getConnectedChildrenAndArrows(editor, shape.id);

      if (childShapes.length === 0) {
        return;
      }

      const savedChildShapes = childShapes.map((s) => JSON.parse(JSON.stringify(s)));
      const savedArrows = arrowShapes.map((a) => JSON.parse(JSON.stringify(a)));
      const savedBindings = relevantBindings.map((b) => JSON.parse(JSON.stringify(b)));

      const safeTitle = shape.props.title || title;
      const newWidth = computeMainNodeWidth(
        safeTitle,
        shape.props.date,
        true,
        childShapes.length
      );

      (editor as any).updateShape({
        id: shape.id,
        type: 'main-node',
        props: {
          ...shape.props,
          w: newWidth,
          isCollapsed: true,
          collapsedCount: childShapes.length,
          collapsedData: {
            childShapes: savedChildShapes,
            arrows: savedArrows,
            bindings: savedBindings,
            anchor: { x: shape.x, y: shape.y },
          },
        },
      });

      const toDelete = [...Array.from(childIds), ...Array.from(arrowIds)];
      editor.deleteShapes(toDelete as any);
      editor.select(shape.id);
    }
  }, [editor, shape.id, shape.props, shape.x, shape.y, title]);

  // Debounced toggle to prevent double invocation from pointerup + click
  const triggerToggle = useCallback(() => {
    if (isEditing) return;
    const now = Date.now();
    if (now - lastToggleRef.current < 260) return;
    lastToggleRef.current = now;
    handleToggleCollapse();
  }, [handleToggleCollapse, isEditing]);

  // Pointer drag listener: differentiates deliberate dragging from a click
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'input') return;

    const startX = e.clientX;
    const startY = e.clientY;
    downPointRef.current = { x: startX, y: startY, time: Date.now() };
    hasMovedRef.current = false;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = Math.abs(moveEvent.clientX - startX);
      const dy = Math.abs(moveEvent.clientY - startY);
      if (dx > 8 || dy > 8) {
        hasMovedRef.current = true;
        setIsPointerDragging(true);
        isDraggingRef.current = true;
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      setIsPointerDragging(false);
      isDraggingRef.current = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);

      const elapsed = downPointRef.current ? Date.now() - downPointRef.current.time : 999;
      const dist = downPointRef.current
        ? Math.hypot(upEvent.clientX - downPointRef.current.x, upEvent.clientY - downPointRef.current.y)
        : 999;

      // Clean click: pointer released within 400ms without dragging
      if (!hasMovedRef.current && dist < 8 && elapsed < 400) {
        triggerToggle();
      }

      // Keep hover active if pointer is still over the node after release
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const isStillInside =
          upEvent.clientX >= rect.left &&
          upEvent.clientX <= rect.right &&
          upEvent.clientY >= rect.top &&
          upEvent.clientY <= rect.bottom;
        setIsHovered(isStillInside);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, [triggerToggle]);

  // Adds a connected Link Node to the canvas without overlapping existing nodes
  const handleAddLinkNode = useCallback(() => {
    if (shape.props.isCollapsed) {
      handleToggleCollapse();
    }
    const linkNodeId = createShapeId();
    const linkWidth = LINK_NODE_WIDTH;
    const initialHeight = computeLinkNodeHeight(1);

    // Find all existing child nodes (link-node, note-node, person-node) connected to this main node
    const { childShapes: connectedChildren } = getConnectedChildrenAndArrows(editor, shape.id);

    const startX = shape.x + shape.props.w + 72;
    let preferredY = shape.y;

    if (connectedChildren.length > 0) {
      let maxBottom = shape.y;
      for (const child of connectedChildren) {
        const b = editor.getShapePageBounds(child.id);
        const bottom = b ? b.maxY : child.y + ((child.props as any)?.h || initialHeight);
        if (bottom > maxBottom) {
          maxBottom = bottom;
        }
      }
      preferredY = maxBottom + 28;
    }

    const { x: finalX, y: finalY } = findNonOverlappingPosition(
      editor,
      { x: startX, y: preferredY, w: linkWidth, h: initialHeight },
      { preferredDirection: 'down', margin: 28, excludeShapeIds: [shape.id] }
    );

    const initialLink: LinkItem = {
      id: `link-${Date.now()}`,
      url: '',
      type: 'empty',
    };

    (editor as any).createShape({
      id: linkNodeId,
      type: 'link-node',
      x: finalX,
      y: finalY,
      props: {
        w: linkWidth,
        h: initialHeight,
        mainNodeId: shape.id,
        links: [initialLink],
      },
    });

    // Connect with a sleek arrow between main node and link node
    try {
      const arrowId = createShapeId();
      editor.createShapes([
        {
          id: arrowId,
          type: 'arrow',
          props: {
            color: 'light-violet',
            dash: 'draw',
            size: 's',
          },
          meta: {
            startNodeId: shape.id,
            endNodeId: linkNodeId,
          },
        },
      ]);
      editor.createBindings([
        {
          type: 'arrow',
          fromId: arrowId,
          toId: shape.id,
          props: { terminal: 'start', isExact: false, isPrecise: false, normalizedAnchor: { x: 1, y: 0.5 } },
        },
        {
          type: 'arrow',
          fromId: arrowId,
          toId: linkNodeId,
          props: { terminal: 'end', isExact: false, isPrecise: false, normalizedAnchor: { x: 0, y: 0.5 } },
        },
      ]);
    } catch {
      // Fallback gracefully if bindings aren't supported on this shape type
    }

    editor.select(linkNodeId);
  }, [editor, shape.id, shape.props.w, shape.x, shape.y]);

  // Adds a connected Note Node (resizable lined notebook page) to the canvas without overlapping existing nodes
  const handleAddNoteNode = useCallback(() => {
    if (shape.props.isCollapsed) {
      handleToggleCollapse();
    }
    const noteNodeId = createShapeId();
    const noteWidth = DEFAULT_NOTE_WIDTH;
    const noteHeight = DEFAULT_NOTE_HEIGHT;

    // Find all existing child nodes (note-node, link-node, person-node) connected to this main node
    const { childShapes: connectedChildren } = getConnectedChildrenAndArrows(editor, shape.id);

    const startX = shape.x + shape.props.w + 72;
    let preferredY = shape.y;

    if (connectedChildren.length > 0) {
      let maxBottom = shape.y;
      for (const child of connectedChildren) {
        const b = editor.getShapePageBounds(child.id);
        const bottom = b ? b.maxY : child.y + ((child.props as any)?.h || noteHeight);
        if (bottom > maxBottom) {
          maxBottom = bottom;
        }
      }
      preferredY = maxBottom + 28;
    }

    const { x: finalX, y: finalY } = findNonOverlappingPosition(
      editor,
      { x: startX, y: preferredY, w: noteWidth, h: noteHeight },
      { preferredDirection: 'down', margin: 28, excludeShapeIds: [shape.id] }
    );

    (editor as any).createShape({
      id: noteNodeId,
      type: 'note-node',
      x: finalX,
      y: finalY,
      props: {
        w: noteWidth,
        h: noteHeight,
        mainNodeId: shape.id,
        title: 'Canvas Note',
        content: '',
        color: '#fffdfa',
        drawings: [],
        innerShapes: [],
        isExpanded: false,
      },
    });

    // Connect with a sleek arrow between main node and note node
    try {
      const arrowId = createShapeId();
      editor.createShapes([
        {
          id: arrowId,
          type: 'arrow',
          props: {
            color: 'light-violet',
            dash: 'draw',
            size: 's',
          },
          meta: {
            startNodeId: shape.id,
            endNodeId: noteNodeId,
          },
        },
      ]);
      editor.createBindings([
        {
          type: 'arrow',
          fromId: arrowId,
          toId: shape.id,
          props: { terminal: 'start', isExact: false, isPrecise: false, normalizedAnchor: { x: 1, y: 0.5 } },
        },
        {
          type: 'arrow',
          fromId: arrowId,
          toId: noteNodeId,
          props: { terminal: 'end', isExact: false, isPrecise: false, normalizedAnchor: { x: 0, y: 0.5 } },
        },
      ]);
    } catch {
      // Fallback gracefully
    }

    editor.select(noteNodeId);
  }, [editor, shape.id, shape.props.w, shape.x, shape.y]);

  // Adds a connected Simple Note Node (fixed size lined notebook page with typable lines) to the canvas
  const handleAddSimpleNoteNode = useCallback(() => {
    if (shape.props.isCollapsed) {
      handleToggleCollapse();
    }
    const simpleNoteNodeId = createShapeId();
    const noteWidth = SIMPLE_NOTE_WIDTH;
    const noteHeight = SIMPLE_NOTE_HEIGHT;

    // Find all existing child nodes connected to this main node
    const { childShapes: connectedChildren } = getConnectedChildrenAndArrows(editor, shape.id);

    const startX = shape.x + shape.props.w + 72;
    let preferredY = shape.y;

    if (connectedChildren.length > 0) {
      let maxBottom = shape.y;
      for (const child of connectedChildren) {
        const b = editor.getShapePageBounds(child.id);
        const bottom = b ? b.maxY : child.y + ((child.props as any)?.h || noteHeight);
        if (bottom > maxBottom) {
          maxBottom = bottom;
        }
      }
      preferredY = maxBottom + 28;
    }

    const { x: finalX, y: finalY } = findNonOverlappingPosition(
      editor,
      { x: startX, y: preferredY, w: noteWidth, h: noteHeight },
      { preferredDirection: 'down', margin: 28, excludeShapeIds: [shape.id] }
    );

    (editor as any).createShape({
      id: simpleNoteNodeId,
      type: 'simple-note-node',
      x: finalX,
      y: finalY,
      props: {
        w: noteWidth,
        h: noteHeight,
        mainNodeId: shape.id,
        title: 'Notes',
        content: '',
        color: '#ffffff',
        isExpanded: false,
        simpleNote: true,
      },
    });

    // Connect with a sleek arrow between main node and simple note node
    try {
      const arrowId = createShapeId();
      editor.createShapes([
        {
          id: arrowId,
          type: 'arrow',
          props: {
            color: 'light-violet',
            dash: 'draw',
            size: 's',
          },
          meta: {
            startNodeId: shape.id,
            endNodeId: simpleNoteNodeId,
          },
        },
      ]);
      editor.createBindings([
        {
          type: 'arrow',
          fromId: arrowId,
          toId: shape.id,
          props: { terminal: 'start', isExact: false, isPrecise: false, normalizedAnchor: { x: 1, y: 0.5 } },
        },
        {
          type: 'arrow',
          fromId: arrowId,
          toId: simpleNoteNodeId,
          props: { terminal: 'end', isExact: false, isPrecise: false, normalizedAnchor: { x: 0, y: 0.5 } },
        },
      ]);
    } catch {
      // Fallback gracefully
    }

    editor.select(simpleNoteNodeId);
  }, [editor, shape.id, shape.props.w, shape.x, shape.y]);

  // Adds a connected Person Node (Name input + About input + Links inputs) to the canvas without overlapping existing nodes
  const handleAddPersonNode = useCallback(() => {
    if (shape.props.isCollapsed) {
      handleToggleCollapse();
    }
    const personNodeId = createShapeId();
    const personWidth = PERSON_NODE_WIDTH;
    const initialHeight = computePersonNodeHeight(1);

    // Find all existing child nodes (person-node, link-node, note-node) connected to this main node
    const { childShapes: connectedChildren } = getConnectedChildrenAndArrows(editor, shape.id);

    const startX = shape.x + shape.props.w + 72;
    let preferredY = shape.y;

    if (connectedChildren.length > 0) {
      let maxBottom = shape.y;
      for (const child of connectedChildren) {
        const b = editor.getShapePageBounds(child.id);
        const bottom = b ? b.maxY : child.y + ((child.props as any)?.h || initialHeight);
        if (bottom > maxBottom) {
          maxBottom = bottom;
        }
      }
      preferredY = maxBottom + 28;
    }

    const { x: finalX, y: finalY } = findNonOverlappingPosition(
      editor,
      { x: startX, y: preferredY, w: personWidth, h: initialHeight },
      { preferredDirection: 'down', margin: 28, excludeShapeIds: [shape.id] }
    );

    const initialLink: LinkItem = {
      id: `link-${Date.now()}`,
      url: '',
      type: 'empty',
    };

    (editor as any).createShape({
      id: personNodeId,
      type: 'person-node',
      x: finalX,
      y: finalY,
      props: {
        w: personWidth,
        h: initialHeight,
        mainNodeId: shape.id,
        name: '',
        about: '',
        links: [initialLink],
      },
    });

    // Connect with a sleek arrow between main node and person node
    try {
      const arrowId = createShapeId();
      editor.createShapes([
        {
          id: arrowId,
          type: 'arrow',
          props: {
            color: 'light-violet',
            dash: 'draw',
            size: 's',
          },
          meta: {
            startNodeId: shape.id,
            endNodeId: personNodeId,
          },
        },
      ]);
      editor.createBindings([
        {
          type: 'arrow',
          fromId: arrowId,
          toId: shape.id,
          props: { terminal: 'start', isExact: false, isPrecise: false, normalizedAnchor: { x: 1, y: 0.5 } },
        },
        {
          type: 'arrow',
          fromId: arrowId,
          toId: personNodeId,
          props: { terminal: 'end', isExact: false, isPrecise: false, normalizedAnchor: { x: 0, y: 0.5 } },
        },
      ]);
    } catch {
      // Fallback gracefully
    }

    editor.select(personNodeId);
  }, [editor, shape.id, shape.props.w, shape.x, shape.y]);

  const isSelected = useValue(
    'is-main-node-selected',
    () => editor.getSelectedShapeIds().includes(shape.id),
    [editor, shape.id]
  );
  const [isClicked, setIsClicked] = useState(false);
  const showOverhead = (isSelected || isClicked || isHovered) && !isEditing && !isDragging;

  // Keep local title in sync if external shape updates occur when NOT editing
  useEffect(() => {
    if (isEditing) return;
    setTitle(shape.props.title || 'Main Node');
  }, [shape.props.title, isEditing]);

  const handleFinishEditing = useCallback(() => {
    setIsEditing(false);
    const trimmed = title.trim();
    const finalTitle = trimmed || 'Main Node';
    setTitle(finalTitle);
    const newWidth = computeMainNodeWidth(
      finalTitle,
      shape.props.date,
      shape.props.isCollapsed,
      shape.props.collapsedCount
    );
    (editor as any).updateShape({
      id: shape.id,
      type: 'main-node',
      props: {
        ...shape.props,
        title: finalTitle,
        w: newWidth,
        h: MAIN_NODE_HEIGHT,
      },
    });
  }, [editor, shape.id, shape.props, title]);

  return (
    <HTMLContainer style={{ pointerEvents: 'all', overflow: 'visible' }}>
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onClick={() => {
          if (isEditing) return;
          setIsClicked(true);
          triggerToggle();
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          if (!isDraggingRef.current) {
            setIsHovered(false);
          }
        }}
        style={{
          position: 'relative',
          width: shape.props.w,
          height: MAIN_NODE_HEIGHT,
          borderRadius: '20px',
          background:
            'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 244, 246, 0.92) 50%, rgba(242, 234, 238, 0.88) 100%)',
          // Hover state: glass gradient boundary (active on hover OR when dragging across canvas)
          border: isHoverStateActive
            ? '2px solid rgba(255, 255, 255, 0.95)'
            : '1.5px solid rgba(225, 205, 215, 0.55)',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          // Signature liquid glass gradient boundary on hover/drag
          boxShadow: isHoverStateActive
            ? [
                '0 -1px 2px 0 rgba(255, 255, 255, 0.95)',
                '0 0 0 2px rgba(244, 114, 182, 0.42)',
                '0 0 0 4.5px rgba(214, 211, 209, 0.48)',
                '0 0 0 6px rgba(255, 255, 255, 0.65)',
                '0 20px 40px -6px rgba(236, 72, 153, 0.16)',
                '0 12px 28px -4px rgba(120, 113, 108, 0.16)',
                'inset 0 2px 4px 0 rgba(255, 255, 255, 1)',
                'inset 0 -2px 4px 0 rgba(244, 114, 182, 0.22)',
                'inset 0 0 0 1px rgba(231, 229, 228, 0.55)',
              ].join(', ')
            : '0 8px 24px -4px rgba(244, 114, 182, 0.12), 0 2px 6px -1px rgba(0, 0, 0, 0.04), inset 0 1px 1.5px 0 rgba(255, 255, 255, 1)',
          transform: isHoverStateActive ? 'scale(1.02)' : 'scale(1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '16px', // Exact 16px padding from all sides without text crowding
          boxSizing: 'border-box',
          gap: '4px',
          userSelect: 'none',
          cursor: isDragging ? 'grabbing' : 'pointer',
          overflow: 'visible',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Overhead Circular Actions Container with Link and Notes Icons side-by-side */}
        <div
          style={{
            position: 'absolute',
            top: '-52px',
            left: '50%',
            transform: showOverhead
              ? 'translateX(-50%) translateY(0) scale(1)'
              : 'translateX(-50%) translateY(16px) scale(0.4)',
            opacity: showOverhead ? 1 : 0,
            pointerEvents: showOverhead ? 'auto' : 'none',
            zIndex: 100,
            transition:
              'opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Row of Action Buttons: Rename + Link + Notes + Person */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Rename / Edit Title Button */}
            <button
              type="button"
              title="Rename Main Node"
              onClick={(e) => {
                e.stopPropagation();
                setTitle(shape.props.title || '');
                setIsEditing(true);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background:
                  'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 244, 246, 0.95) 100%)',
                border: '1.5px solid rgba(244, 114, 182, 0.55)',
                backdropFilter: 'blur(24px) saturate(160%)',
                WebkitBackdropFilter: 'blur(24px) saturate(160%)',
                boxShadow:
                  '0 8px 20px -2px rgba(244, 114, 182, 0.35), 0 2px 6px -1px rgba(0, 0, 0, 0.06), inset 0 1.5px 2px 0 rgba(255, 255, 255, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#be185d',
                transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                outline: 'none',
                padding: 0,
              }}
              className="hover:scale-115 active:scale-95"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#be185d"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
              </svg>
            </button>

            {/* Link Icon Button */}
            <button
              type="button"
              title="Add Link Node"
              onClick={(e) => {
                e.stopPropagation();
                handleAddLinkNode();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background:
                  'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 244, 246, 0.95) 100%)',
                border: '1.5px solid rgba(244, 114, 182, 0.55)',
                backdropFilter: 'blur(24px) saturate(160%)',
                WebkitBackdropFilter: 'blur(24px) saturate(160%)',
                boxShadow:
                  '0 8px 20px -2px rgba(244, 114, 182, 0.35), 0 2px 6px -1px rgba(0, 0, 0, 0.06), inset 0 1.5px 2px 0 rgba(255, 255, 255, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#be185d',
                transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                outline: 'none',
                padding: 0,
              }}
              className="hover:scale-115 active:scale-95"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#be185d"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </button>

            {/* Notes Icon Button (on the side of the link icon) */}
            <button
              type="button"
              title="Add Note Node"
              onClick={(e) => {
                e.stopPropagation();
                handleAddNoteNode();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background:
                  'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 244, 246, 0.95) 100%)',
                border: '1.5px solid rgba(244, 114, 182, 0.55)',
                backdropFilter: 'blur(24px) saturate(160%)',
                WebkitBackdropFilter: 'blur(24px) saturate(160%)',
                boxShadow:
                  '0 8px 20px -2px rgba(244, 114, 182, 0.35), 0 2px 6px -1px rgba(0, 0, 0, 0.06), inset 0 1.5px 2px 0 rgba(255, 255, 255, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#be185d',
                transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                outline: 'none',
                padding: 0,
              }}
              className="hover:scale-115 active:scale-95"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#be185d"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="4" y="3" width="16" height="18" rx="2" />
                <line x1="8" y1="3" x2="8" y2="21" />
                <line x1="12" y1="8" x2="16" y2="8" />
                <line x1="12" y1="12" x2="16" y2="12" />
                <line x1="12" y1="16" x2="16" y2="16" />
              </svg>
            </button>

            {/* Simple Note Node Button (clean typable notebook page) */}
            <button
              type="button"
              title="Add Simple Note (Lined Notebook)"
              onClick={(e) => {
                e.stopPropagation();
                handleAddSimpleNoteNode();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background:
                  'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 244, 246, 0.95) 100%)',
                border: '1.5px solid rgba(244, 114, 182, 0.55)',
                backdropFilter: 'blur(24px) saturate(160%)',
                WebkitBackdropFilter: 'blur(24px) saturate(160%)',
                boxShadow:
                  '0 8px 20px -2px rgba(244, 114, 182, 0.35), 0 2px 6px -1px rgba(0, 0, 0, 0.06), inset 0 1.5px 2px 0 rgba(255, 255, 255, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#be185d',
                transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                outline: 'none',
                padding: 0,
              }}
              className="hover:scale-115 active:scale-95"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#be185d"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M8 7h8" />
                <path d="M8 11h8" />
                <path d="M8 15h5" />
              </svg>
            </button>

            {/* Person Icon Button (beside other node icons) */}
            <button
              type="button"
              title="Add Person Node"
              onClick={(e) => {
                e.stopPropagation();
                handleAddPersonNode();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background:
                  'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 244, 246, 0.95) 100%)',
                border: '1.5px solid rgba(244, 114, 182, 0.55)',
                backdropFilter: 'blur(24px) saturate(160%)',
                WebkitBackdropFilter: 'blur(24px) saturate(160%)',
                boxShadow:
                  '0 8px 20px -2px rgba(244, 114, 182, 0.35), 0 2px 6px -1px rgba(0, 0, 0, 0.06), inset 0 1.5px 2px 0 rgba(255, 255, 255, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#be185d',
                transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                outline: 'none',
                padding: 0,
              }}
              className="hover:scale-115 active:scale-95"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#be185d"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
          </div>

          {/* Subtle connector stem linking overhead group to the node */}
          <div
            style={{
              width: '3px',
              height: '8px',
              backgroundColor: 'rgba(244, 114, 182, 0.55)',
              borderRadius: '2px',
              marginTop: '2px',
            }}
          />
        </div>

        {/* Heading (Title) */}
        {isEditing ? (
          <input
            autoFocus
            type="text"
            value={title}
            placeholder="Main Node"
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const nextVal = e.target.value;
              setTitle(nextVal);
              const dynamicW = computeMainNodeWidth(
                nextVal || 'Main Node',
                shape.props.date,
                shape.props.isCollapsed,
                shape.props.collapsedCount
              );
              (editor as any).updateShape({
                id: shape.id,
                type: 'main-node',
                props: {
                  ...shape.props,
                  title: nextVal,
                  w: dynamicW,
                  h: MAIN_NODE_HEIGHT,
                },
              });
            }}
            onBlur={handleFinishEditing}
            onKeyDown={(e) => {
              e.stopPropagation();
              (e.nativeEvent as any)?.stopImmediatePropagation?.();
              if (e.key === 'Enter') handleFinishEditing();
              if (e.key === 'Escape') {
                setTitle(shape.props.title || 'Main Node');
                setIsEditing(false);
              }
            }}
            onKeyUp={(e) => {
              e.stopPropagation();
              (e.nativeEvent as any)?.stopImmediatePropagation?.();
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.nativeEvent as any)?.stopImmediatePropagation?.();
            }}
            onClick={(e) => {
              e.stopPropagation();
              (e.nativeEvent as any)?.stopImmediatePropagation?.();
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              (e.nativeEvent as any)?.stopImmediatePropagation?.();
            }}
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: '#272224',
              padding: '2px 6px',
              margin: '-2px -6px',
              border: 'none',
              borderBottom: '2px solid #ec4899',
              borderRadius: '4px',
              outline: 'none',
              background: 'rgba(255, 255, 255, 0.95)',
              boxShadow: '0 1px 4px rgba(236, 72, 153, 0.2)',
              fontFamily: "'Manrope', sans-serif",
              lineHeight: '1.25',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setTitle(shape.props.title || '');
              setIsEditing(true);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setTitle(shape.props.title || '');
              setIsEditing(true);
            }}
            title="Click or double-click to rename"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'text',
              maxWidth: '100%',
              userSelect: 'none',
            }}
          >
            <span
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: '#272224',
                fontFamily: "'Manrope', sans-serif",
                letterSpacing: '-0.02em',
                lineHeight: '1.25',
                whiteSpace: 'nowrap',
              }}
            >
              {shape.props.title || 'Main Node'}
            </span>

            {/* Subtle edit pencil icon on hover */}
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ec4899"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                opacity: isHoverStateActive ? 0.85 : 0,
                transition: 'opacity 0.15s ease',
                flexShrink: 0,
              }}
            >
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </div>
        )}

        {/* Date Created directly under the heading */}
        <span
          style={{
            fontSize: '11px',
            fontWeight: 500,
            color: '#a1a1aa',
            fontFamily: "'Manrope', sans-serif",
            letterSpacing: '-0.01em',
            lineHeight: '1.2',
            whiteSpace: 'nowrap',
          }}
        >
          {shape.props.date || 'Oct 27, 2026'}
        </span>

        {/* Collapsed Count Badge */}
        {shape.props.isCollapsed && Boolean(shape.props.collapsedCount) && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              triggerToggle();
            }}
            title="Click to expand connected nodes"
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '9999px',
              background: 'rgba(244, 114, 182, 0.2)',
              border: '1.5px solid rgba(244, 114, 182, 0.55)',
              color: '#be185d',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: "'Manrope', sans-serif",
              cursor: 'pointer',
              boxShadow: '0 2px 8px -1px rgba(244, 114, 182, 0.35)',
              userSelect: 'none',
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#be185d"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span>{shape.props.collapsedCount}</span>
          </div>
        )}
      </div>
    </HTMLContainer>
  );
}

/**
 * Custom ShapeUtil for Main Node:
 * - canResize returns false to disallow manual resizing
 * - width changes automatically according to heading length
 * - height is strictly fixed at 68px
 * - hides default blue square selection bounds to let the glass gradient boundary shine
 */
export class MainNodeShapeUtil extends BaseBoxShapeUtil<any> {
  static override type = 'main-node' as const;

  override canResize(_shape: MainNodeShape) {
    return false;
  }

  override hideSelectionBoundsFg(_shape: MainNodeShape) {
    return true;
  }

  override hideSelectionBoundsBg(_shape: MainNodeShape) {
    return true;
  }

  override hideRotateHandle(_shape: MainNodeShape) {
    return true;
  }

  override getIndicatorPath(_shape: MainNodeShape) {
    return undefined;
  }

  override getDefaultProps(): MainNodeShape['props'] {
    return {
      w: computeMainNodeWidth('Main Node', 'Oct 27, 2026'),
      h: MAIN_NODE_HEIGHT,
      title: 'Main Node',
      date: 'Oct 27, 2026',
      color: '#EF3167',
    };
  }

  override getGeometry(shape: MainNodeShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: MAIN_NODE_HEIGHT,
      isFilled: true,
    });
  }

  override component(shape: MainNodeShape) {
    return <MainNodeComponent shape={shape} />;
  }
}

/**
 * React Component for the Link Node shape rendered on the Tldraw canvas.
 * - Input field for links
 * - Automatically detects LinkedIn vs Website
 * - Displays brand badges (LinkedIn icon or Web globe)
 * - Small '+' icon to add multiple links
 * - Signature liquid frosted glass design with dynamic container height
 */
function LinkNodeComponent({ shape }: { shape: LinkNodeShape }) {
  const editor = useEditor();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const links: LinkItem[] = shape.props.links && shape.props.links.length > 0
    ? shape.props.links
    : [{ id: 'link-1', url: '', type: 'empty' }];

  const [isHovered, setIsHovered] = useState(false);
  const [isPointerDragging, setIsPointerDragging] = useState(false);
  const [isAddHovered, setIsAddHovered] = useState(false);

  // Reactively track if this shape is currently being translated (dragged) in tldraw
  const isTranslating = useValue(
    'is-link-translating',
    () => {
      const isSelected = editor.getSelectedShapeIds().includes(shape.id);
      if (!isSelected) return false;
      const path = editor.getPath();
      return (
        path.includes('translating') ||
        path.includes('dragging') ||
        editor.inputs.getIsDragging()
      );
    },
    [editor, shape.id]
  );

  const isDragging = isTranslating || isPointerDragging;
  const isHoverStateActive = isHovered || isDragging;

  const isDraggingRef = useRef(false);
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'input') return;
    if ((e.target as HTMLElement).closest('button, a')) return;

    const startX = e.clientX;
    const startY = e.clientY;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = Math.abs(moveEvent.clientX - startX);
      const dy = Math.abs(moveEvent.clientY - startY);
      if (dx > 3 || dy > 3) {
        setIsPointerDragging(true);
        isDraggingRef.current = true;
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      setIsPointerDragging(false);
      isDraggingRef.current = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const isStillInside =
          upEvent.clientX >= rect.left &&
          upEvent.clientX <= rect.right &&
          upEvent.clientY >= rect.top &&
          upEvent.clientY <= rect.bottom;
        setIsHovered(isStillInside);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, []);

  // Update a specific link item's URL and detected type
  const handleUpdateLink = useCallback(
    (id: string, newUrl: string) => {
      const detected = detectLinkType(newUrl);
      const updatedLinks = links.map((l) =>
        l.id === id ? { ...l, url: newUrl, type: detected } : l
      );
      (editor as any).updateShape({
        id: shape.id,
        type: 'link-node',
        props: {
          ...shape.props,
          links: updatedLinks,
        },
      });
    },
    [editor, links, shape.id, shape.props]
  );

  // Add a new link item via the small '+' icon
  const handleAddNewLink = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const newId = `link-${Date.now()}`;
      const newLink: LinkItem = {
        id: newId,
        url: '',
        type: 'empty',
      };
      const nextLinks = [...links, newLink];
      const nextHeight = computeLinkNodeHeight(nextLinks.length);

      (editor as any).updateShape({
        id: shape.id,
        type: 'link-node',
        props: {
          ...shape.props,
          h: nextHeight,
          links: nextLinks,
        },
      });
    },
    [editor, links, shape.id, shape.props]
  );

  // Remove a link item
  const handleRemoveLink = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      let nextLinks = links.filter((l) => l.id !== id);
      if (nextLinks.length === 0) {
        nextLinks = [{ id: `link-${Date.now()}`, url: '', type: 'empty' }];
      }
      const nextHeight = computeLinkNodeHeight(nextLinks.length);

      (editor as any).updateShape({
        id: shape.id,
        type: 'link-node',
        props: {
          ...shape.props,
          h: nextHeight,
          links: nextLinks,
        },
      });
    },
    [editor, links, shape.id, shape.props]
  );

  return (
    <HTMLContainer style={{ pointerEvents: 'all' }}>
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          if (!isDraggingRef.current) {
            setIsHovered(false);
          }
        }}
        style={{
          width: shape.props.w || LINK_NODE_WIDTH,
          height: shape.props.h || computeLinkNodeHeight(links.length),
          borderRadius: '20px',
          background:
            'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 244, 246, 0.94) 50%, rgba(242, 234, 238, 0.9) 100%)',
          border: isHoverStateActive
            ? '2px solid rgba(255, 255, 255, 0.95)'
            : '1.5px solid rgba(225, 205, 215, 0.55)',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          boxShadow: isHoverStateActive
            ? [
                '0 -1px 2px 0 rgba(255, 255, 255, 0.95)',
                '0 0 0 2px rgba(244, 114, 182, 0.42)',
                '0 0 0 4.5px rgba(214, 211, 209, 0.48)',
                '0 0 0 6px rgba(255, 255, 255, 0.65)',
                '0 20px 40px -6px rgba(236, 72, 153, 0.16)',
                '0 12px 28px -4px rgba(120, 113, 108, 0.16)',
                'inset 0 2px 4px 0 rgba(255, 255, 255, 1)',
                'inset 0 -2px 4px 0 rgba(244, 114, 182, 0.22)',
                'inset 0 0 0 1px rgba(231, 229, 228, 0.55)',
              ].join(', ')
            : '0 8px 24px -4px rgba(244, 114, 182, 0.12), 0 2px 6px -1px rgba(0, 0, 0, 0.04), inset 0 1px 1.5px 0 rgba(255, 255, 255, 1)',
          transform: isHoverStateActive ? 'scale(1.02)' : 'scale(1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 14px',
          boxSizing: 'border-box',
          userSelect: 'none',
          cursor: isDragging ? 'grabbing' : 'default',
          overflow: 'hidden',
          gap: '8px',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Link Input Field(s) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            width: '100%',
          }}
        >
          {links.map((link, idx) => {
            const hasUrl = Boolean(link.url.trim());
            const fullHref = hasUrl
              ? /^https?:\/\//i.test(link.url.trim())
                ? link.url.trim()
                : `https://${link.url.trim()}`
              : '';

            return (
              <div
                key={link.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '9999px',
                  background: 'rgba(255, 255, 255, 0.95)',
                  border: '1.5px solid #ec4899',
                  boxShadow: '0 2px 8px rgba(236, 72, 153, 0.12)',
                  boxSizing: 'border-box',
                }}
              >
                {/* Auto-detected Icon */}
                {link.type === 'linkedin' ? (
                  <div
                    title="LinkedIn"
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      backgroundColor: '#0A66C2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    in
                  </div>
                ) : (
                  <div
                    title="Website"
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(236, 72, 153, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ec4899',
                      flexShrink: 0,
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  </div>
                )}

                {/* Direct Link Input */}
                <input
                  type="text"
                  placeholder="Paste link (e.g. linkedin.com/in/... or website.com)"
                  value={link.url}
                  onChange={(e) => handleUpdateLink(link.id, e.target.value)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  style={{
                    flex: 1,
                    fontSize: '12px',
                    fontFamily: "'Manrope', sans-serif",
                    fontWeight: 600,
                    color: '#272224',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    padding: '0',
                    margin: '0',
                    minWidth: 0,
                  }}
                />

                {/* Right Action Icons: Open Link, Checkmark, Remove */}
                {hasUrl && (
                  <>
                    <a
                      href={fullHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open link in new tab"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#be185d',
                        textDecoration: 'none',
                        cursor: 'pointer',
                        padding: '2px',
                        flexShrink: 0,
                      }}
                      className="hover:scale-110 active:scale-95"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>

                    <div
                      title="Link detected"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#16a34a',
                        flexShrink: 0,
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  </>
                )}

                {links.length > 1 && (
                  <button
                    type="button"
                    title="Remove link"
                    onClick={(e) => handleRemoveLink(link.id, e)}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#a1a1aa',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                    className="hover:text-red-500"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Plus Button to Add More Links (Light & transparent, solid white/pink on hover) */}
        <button
          type="button"
          title="Add another link"
          onClick={handleAddNewLink}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseEnter={() => setIsAddHovered(true)}
          onMouseLeave={() => setIsAddHovered(false)}
          style={{
            width: '100%',
            height: '38px',
            borderRadius: '9999px',
            backgroundColor: isAddHovered ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.25)',
            border: isAddHovered ? '1.5px solid #ec4899' : '1.5px solid rgba(244, 114, 182, 0.35)',
            boxShadow: isAddHovered ? '0 2px 8px rgba(236, 72, 153, 0.16)' : 'none',
            boxSizing: 'border-box',
            color: isAddHovered ? '#be185d' : 'rgba(190, 24, 93, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transform: isAddHovered ? 'scale(1.01)' : 'scale(1)',
            transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            flexShrink: 0,
          }}
          className="active:scale-[0.99]"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </HTMLContainer>
  );
}

/**
 * Custom ShapeUtil for Link Node:
 * - canResize returns false to disallow manual resizing
 * - height adjusts dynamically based on the number of links
 * - hides default blue square selection bounds
 */
export class LinkNodeShapeUtil extends BaseBoxShapeUtil<any> {
  static override type = 'link-node' as const;

  override canResize(_shape: LinkNodeShape) {
    return false;
  }

  override hideSelectionBoundsFg(_shape: LinkNodeShape) {
    return true;
  }

  override hideSelectionBoundsBg(_shape: LinkNodeShape) {
    return true;
  }

  override hideRotateHandle(_shape: LinkNodeShape) {
    return true;
  }

  override getIndicatorPath(_shape: LinkNodeShape) {
    return undefined;
  }

  override getDefaultProps(): LinkNodeShape['props'] {
    return {
      w: LINK_NODE_WIDTH,
      h: computeLinkNodeHeight(1),
      links: [
        {
          id: 'link-1',
          url: '',
          type: 'empty',
        },
      ],
    };
  }

  override getGeometry(shape: LinkNodeShape) {
    return new Rectangle2d({
      width: shape.props.w || LINK_NODE_WIDTH,
      height: shape.props.h || computeLinkNodeHeight(shape.props.links?.length || 1),
      isFilled: true,
    });
  }

  override component(shape: LinkNodeShape) {
    return <LinkNodeComponent shape={shape} />;
  }
}

/**
 * React Component for the Person Node shape rendered on the Tldraw canvas.
 * - Profile avatar + Name input
 * - About / Role / Bio input
 * - Links section with LinkedIn / Website detection, external link launch, and '+' add button
 * - Signature liquid frosted glass design with dynamic container height
 */
function PersonNodeComponent({ shape }: { shape: PersonNodeShape }) {
  const editor = useEditor();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const links: LinkItem[] =
    shape.props.links && shape.props.links.length > 0
      ? shape.props.links
      : [{ id: 'link-1', url: '', type: 'empty' }];

  const [name, setName] = useState(shape.props.name || '');
  const [about, setAbout] = useState(shape.props.about || '');
  const [isHovered, setIsHovered] = useState(false);
  const [isPointerDragging, setIsPointerDragging] = useState(false);
  const [isAddHovered, setIsAddHovered] = useState(false);

  useEffect(() => {
    setName(shape.props.name || '');
  }, [shape.props.name]);

  useEffect(() => {
    setAbout(shape.props.about || '');
  }, [shape.props.about]);

  const isTranslating = useValue(
    'is-person-translating',
    () => {
      const isSelected = editor.getSelectedShapeIds().includes(shape.id);
      if (!isSelected) return false;
      const path = editor.getPath();
      return (
        path.includes('translating') ||
        path.includes('dragging') ||
        editor.inputs.getIsDragging()
      );
    },
    [editor, shape.id]
  );

  const isDragging = isTranslating || isPointerDragging;
  const isHoverStateActive = isHovered || isDragging;

  const isDraggingRef = useRef(false);
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'input') return;
    if ((e.target as HTMLElement).closest('button, a')) return;

    const startX = e.clientX;
    const startY = e.clientY;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = Math.abs(moveEvent.clientX - startX);
      const dy = Math.abs(moveEvent.clientY - startY);
      if (dx > 3 || dy > 3) {
        setIsPointerDragging(true);
        isDraggingRef.current = true;
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      setIsPointerDragging(false);
      isDraggingRef.current = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const isStillInside =
          upEvent.clientX >= rect.left &&
          upEvent.clientX <= rect.right &&
          upEvent.clientY >= rect.top &&
          upEvent.clientY <= rect.bottom;
        setIsHovered(isStillInside);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, []);

  const handleNameChange = (val: string) => {
    setName(val);
    (editor as any).updateShape({
      id: shape.id,
      type: 'person-node',
      props: {
        ...shape.props,
        name: val,
      },
    });
  };

  const handleAboutChange = (val: string) => {
    setAbout(val);
    (editor as any).updateShape({
      id: shape.id,
      type: 'person-node',
      props: {
        ...shape.props,
        about: val,
      },
    });
  };

  const handleUpdateLink = useCallback(
    (id: string, newUrl: string) => {
      const detected = detectLinkType(newUrl);
      const updatedLinks = links.map((l) =>
        l.id === id ? { ...l, url: newUrl, type: detected } : l
      );
      (editor as any).updateShape({
        id: shape.id,
        type: 'person-node',
        props: {
          ...shape.props,
          links: updatedLinks,
        },
      });
    },
    [editor, links, shape.id, shape.props]
  );

  const handleAddNewLink = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const newId = `link-${Date.now()}`;
      const newLink: LinkItem = {
        id: newId,
        url: '',
        type: 'empty',
      };
      const nextLinks = [...links, newLink];
      const nextHeight = computePersonNodeHeight(nextLinks.length);

      (editor as any).updateShape({
        id: shape.id,
        type: 'person-node',
        props: {
          ...shape.props,
          h: nextHeight,
          links: nextLinks,
        },
      });
    },
    [editor, links, shape.id, shape.props]
  );

  const handleRemoveLink = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      let nextLinks = links.filter((l) => l.id !== id);
      if (nextLinks.length === 0) {
        nextLinks = [{ id: `link-${Date.now()}`, url: '', type: 'empty' }];
      }
      const nextHeight = computePersonNodeHeight(nextLinks.length);

      (editor as any).updateShape({
        id: shape.id,
        type: 'person-node',
        props: {
          ...shape.props,
          h: nextHeight,
          links: nextLinks,
        },
      });
    },
    [editor, links, shape.id, shape.props]
  );

  const currentW = shape.props.w || PERSON_NODE_WIDTH;
  const currentH = shape.props.h || computePersonNodeHeight(links.length);

  return (
    <HTMLContainer style={{ pointerEvents: 'all' }}>
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          if (!isDraggingRef.current) {
            setIsHovered(false);
          }
        }}
        style={{
          width: currentW,
          height: currentH,
          borderRadius: '20px',
          background:
            'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 244, 246, 0.94) 50%, rgba(242, 234, 238, 0.9) 100%)',
          border: isHoverStateActive
            ? '2px solid rgba(255, 255, 255, 0.95)'
            : '1.5px solid rgba(225, 205, 215, 0.55)',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          boxShadow: isHoverStateActive
            ? [
                '0 -1px 2px 0 rgba(255, 255, 255, 0.95)',
                '0 0 0 2px rgba(244, 114, 182, 0.42)',
                '0 0 0 4.5px rgba(214, 211, 209, 0.48)',
                '0 0 0 6px rgba(255, 255, 255, 0.65)',
                '0 20px 40px -6px rgba(236, 72, 153, 0.16)',
                '0 12px 28px -4px rgba(120, 113, 108, 0.16)',
                'inset 0 2px 4px 0 rgba(255, 255, 255, 1)',
                'inset 0 -2px 4px 0 rgba(244, 114, 182, 0.22)',
                'inset 0 0 0 1px rgba(231, 229, 228, 0.55)',
              ].join(', ')
            : '0 8px 24px -4px rgba(244, 114, 182, 0.12), 0 2px 6px -1px rgba(0, 0, 0, 0.04), inset 0 1px 1.5px 0 rgba(255, 255, 255, 1)',
          transform: isHoverStateActive ? 'scale(1.02)' : 'scale(1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          padding: '14px',
          boxSizing: 'border-box',
          userSelect: 'none',
          cursor: isDragging ? 'grabbing' : 'default',
          overflow: 'hidden',
          gap: '8px',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Name Input */}
        <input
          type="text"
          placeholder="Person Name..."
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            fontSize: '14px',
            fontWeight: 700,
            color: '#272224',
            fontFamily: "'Manrope', sans-serif",
            background: 'rgba(255, 255, 255, 0.85)',
            border: '1.5px solid rgba(244, 114, 182, 0.4)',
            borderRadius: '9999px',
            padding: '6px 14px',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease',
          }}
          className="focus:border-pink-500"
        />

        {/* About / Bio Input */}
        <input
          type="text"
          placeholder="About (e.g. Founder, Designer, Engineer)..."
          value={about}
          onChange={(e) => handleAboutChange(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: '#4a4447',
            fontFamily: "'Manrope', sans-serif",
            background: 'rgba(255, 255, 255, 0.75)',
            border: '1px solid rgba(225, 205, 215, 0.7)',
            borderRadius: '10px',
            padding: '6px 12px',
            outline: 'none',
            boxSizing: 'border-box',
            width: '100%',
          }}
          className="focus:border-pink-400"
        />


        {/* Links List */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            width: '100%',
          }}
        >
          {links.map((link, idx) => {
            const hasUrl = Boolean(link.url.trim());
            const fullHref = hasUrl
              ? /^https?:\/\//i.test(link.url.trim())
                ? link.url.trim()
                : `https://${link.url.trim()}`
              : '';

            return (
              <div
                key={link.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  height: '36px',
                  padding: '0 10px',
                  borderRadius: '9999px',
                  background: 'rgba(255, 255, 255, 0.95)',
                  border: '1.5px solid #ec4899',
                  boxShadow: '0 2px 6px rgba(236, 72, 153, 0.1)',
                  boxSizing: 'border-box',
                }}
              >
                {/* Auto-detected Icon */}
                {link.type === 'linkedin' ? (
                  <div
                    title="LinkedIn"
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      backgroundColor: '#0A66C2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    in
                  </div>
                ) : (
                  <div
                    title="Website"
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(236, 72, 153, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ec4899',
                      flexShrink: 0,
                    }}
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  </div>
                )}

                {/* Direct Link Input */}
                <input
                  type="text"
                  placeholder="Paste link (linkedin.com/in/... or website.com)"
                  value={link.url}
                  onChange={(e) => handleUpdateLink(link.id, e.target.value)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  style={{
                    flex: 1,
                    fontSize: '11px',
                    fontFamily: "'Manrope', sans-serif",
                    fontWeight: 600,
                    color: '#272224',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    minWidth: 0,
                  }}
                />

                {/* Visit External Link button */}
                {fullHref && (
                  <a
                    href={fullHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="Open link in new tab"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ec4899',
                      padding: '2px',
                      borderRadius: '4px',
                      flexShrink: 0,
                    }}
                    className="hover:scale-120 active:scale-95"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                )}

                {/* Remove link button */}
                {links.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => handleRemoveLink(link.id, e)}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="Remove link"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#9ca3af',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                    className="hover:text-red-500"
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Plus Button to Add More Links (Light & transparent, solid white/pink on hover) */}
        <button
          type="button"
          title="Add another link"
          onClick={handleAddNewLink}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseEnter={() => setIsAddHovered(true)}
          onMouseLeave={() => setIsAddHovered(false)}
          style={{
            width: '100%',
            height: '38px',
            borderRadius: '9999px',
            backgroundColor: isAddHovered ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.25)',
            border: isAddHovered ? '1.5px solid #ec4899' : '1.5px solid rgba(244, 114, 182, 0.35)',
            boxShadow: isAddHovered ? '0 2px 8px rgba(236, 72, 153, 0.16)' : 'none',
            boxSizing: 'border-box',
            color: isAddHovered ? '#be185d' : 'rgba(190, 24, 93, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transform: isAddHovered ? 'scale(1.01)' : 'scale(1)',
            transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            flexShrink: 0,
          }}
          className="active:scale-[0.99]"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </HTMLContainer>
  );
}

/**
 * Custom ShapeUtil for Person Node:
 * - canResize returns false to disallow manual resizing
 * - height adjusts dynamically based on the number of links
 * - hides default blue square selection bounds
 */
export class PersonNodeShapeUtil extends BaseBoxShapeUtil<any> {
  static override type = 'person-node' as const;

  override canResize(_shape: PersonNodeShape) {
    return false;
  }

  override hideSelectionBoundsFg(_shape: PersonNodeShape) {
    return true;
  }

  override hideSelectionBoundsBg(_shape: PersonNodeShape) {
    return true;
  }

  override hideRotateHandle(_shape: PersonNodeShape) {
    return true;
  }

  override getIndicatorPath(_shape: PersonNodeShape) {
    return undefined;
  }

  override getDefaultProps(): PersonNodeShape['props'] {
    return {
      w: PERSON_NODE_WIDTH,
      h: computePersonNodeHeight(1),
      name: '',
      about: '',
      links: [
        {
          id: 'link-1',
          url: '',
          type: 'empty',
        },
      ],
    };
  }

  override getGeometry(shape: PersonNodeShape) {
    return new Rectangle2d({
      width: shape.props.w || PERSON_NODE_WIDTH,
      height: shape.props.h || computePersonNodeHeight(shape.props.links?.length || 1),
      isFilled: true,
    });
  }

  override component(shape: PersonNodeShape) {
    return <PersonNodeComponent shape={shape} />;
  }
}

/**
 * Full Screen Canvas Note Modal:
 * Opens an immersive full-screen creative drawing canvas with infinite/draggable panning (Hand tool),
 * spacebar drag shortcut, zoom controls, rich color palette, undo/redo, and stroke persistence.
 */
interface FullScreenCanvasNoteModalProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  strokes: NoteStroke[];
  onSaveStrokes: (strokes: NoteStroke[]) => void;
  onClose: () => void;
}

export function FullScreenCanvasNoteModal({
  title,
  onTitleChange,
  strokes,
  onSaveStrokes,
  onClose,
}: FullScreenCanvasNoteModalProps) {
  const [localStrokes, setLocalStrokes] = useState<NoteStroke[]>(strokes);
  const [undoStack, setUndoStack] = useState<NoteStroke[][]>([]);
  const [redoStack, setRedoStack] = useState<NoteStroke[][]>([]);
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser' | 'hand'>('pen');
  const [color, setColor] = useState<string>('#1e293b');
  const [thickness, setThickness] = useState<number>(3);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [isPanning, setIsPanning] = useState<boolean>(false);

  useEffect(() => {
    setLocalStrokes(strokes);
  }, [strokes]);

  // Spacebar and keyboard shortcuts (Escape, Undo, Redo, Tool switching)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'h' || e.key === 'H') {
        setActiveTool('hand');
      } else if (e.key === 'p' || e.key === 'P') {
        setActiveTool('pen');
      } else if (e.key === 'e' || e.key === 'E') {
        setActiveTool('eraser');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [localStrokes, undoStack, redoStack]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, localStrokes]);
    setUndoStack((u) => u.slice(0, -1));
    setLocalStrokes(prev);
    onSaveStrokes(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, localStrokes]);
    setRedoStack((r) => r.slice(0, -1));
    setLocalStrokes(next);
    onSaveStrokes(next);
  };

  const handleClear = () => {
    if (localStrokes.length === 0) return;
    setUndoStack((u) => [...u, localStrokes]);
    setRedoStack([]);
    setLocalStrokes([]);
    onSaveStrokes([]);
  };

  const pointerStateRef = useRef<{
    isDown: boolean;
    mode: 'pan' | 'draw' | null;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
    currentStrokePoints: { x: number; y: number }[];
  }>({
    isDown: false,
    mode: null,
    startClientX: 0,
    startClientY: 0,
    startPanX: 0,
    startPanY: 0,
    currentStrokePoints: [],
  });

  const effectiveTool = isSpacePressed ? 'hand' : activeTool;

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const isPanMode = effectiveTool === 'hand' || e.button === 1 || e.button === 2;

    if (isPanMode) {
      pointerStateRef.current = {
        isDown: true,
        mode: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
        currentStrokePoints: [],
      };
      setIsPanning(true);
    } else {
      const ptX = Math.round((e.clientX - pan.x) / zoom);
      const ptY = Math.round((e.clientY - pan.y) / zoom);

      pointerStateRef.current = {
        isDown: true,
        mode: 'draw',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
        currentStrokePoints: [{ x: ptX, y: ptY }],
      };

      const strokeColor = effectiveTool === 'eraser' ? '#fdfcfe' : color;
      const strokeThickness = effectiveTool === 'eraser' ? 24 : thickness;

      const newStroke: NoteStroke = {
        id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        color: strokeColor,
        size: strokeThickness,
        thickness: strokeThickness,
        dash: 'draw',
        fill: 'none',
        points: [{ x: ptX, y: ptY }],
      };

      setUndoStack((prev) => [...prev, localStrokes]);
      setRedoStack([]);
      setLocalStrokes((prev) => [...prev, newStroke]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const state = pointerStateRef.current;
    if (!state.isDown) return;
    e.stopPropagation();
    e.preventDefault();

    if (state.mode === 'pan') {
      const dx = e.clientX - state.startClientX;
      const dy = e.clientY - state.startClientY;
      setPan({
        x: state.startPanX + dx,
        y: state.startPanY + dy,
      });
    } else if (state.mode === 'draw') {
      const ptX = Math.round((e.clientX - pan.x) / zoom);
      const ptY = Math.round((e.clientY - pan.y) / zoom);
      state.currentStrokePoints.push({ x: ptX, y: ptY });

      setLocalStrokes((prev) => {
        if (prev.length === 0) return prev;
        const last = { ...prev[prev.length - 1], points: [...state.currentStrokePoints] };
        return [...prev.slice(0, -1), last];
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const state = pointerStateRef.current;
    if (!state.isDown) return;
    e.stopPropagation();
    state.isDown = false;
    setIsPanning(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (state.mode === 'draw') {
      setLocalStrokes((latest) => {
        onSaveStrokes(latest);
        return latest;
      });
    }
    state.mode = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const newZoom = Math.min(4, Math.max(0.25, zoom * zoomFactor));
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
      const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);
      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    } else {
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        backgroundColor: '#fcfbfe',
        backgroundImage: 'radial-gradient(circle, rgba(244, 114, 182, 0.22) 1.2px, transparent 1.2px)',
        backgroundSize: '20px 20px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
      }}
      onWheel={handleWheel}
    >
      {/* Floating Top Control Bar */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 16px',
          borderRadius: '20px',
          backgroundColor: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(20px) saturate(160%)',
          border: '1px solid rgba(244, 114, 182, 0.4)',
          boxShadow: '0 16px 36px -6px rgba(244, 114, 182, 0.25), 0 4px 14px rgba(0,0,0,0.06)',
        }}
      >
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#be185d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          <input
            type="text"
            value={title}
            placeholder="Canvas Note"
            onChange={(e) => onTitleChange(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              fontSize: '13.5px',
              fontWeight: 700,
              color: '#1e293b',
              fontFamily: "'Manrope', sans-serif",
              background: 'transparent',
              border: 'none',
              outline: 'none',
              width: '120px',
            }}
          />
        </div>

        <div style={{ width: '1px', height: '22px', backgroundColor: 'rgba(225, 205, 215, 0.6)' }} />

        {/* Draw Pen Tool */}
        <button
          type="button"
          title="Draw with Pen (P)"
          onClick={() => setActiveTool('pen')}
          style={{
            padding: '6px 10px',
            borderRadius: '8px',
            backgroundColor: effectiveTool === 'pen' ? '#fdf2f8' : 'transparent',
            border: effectiveTool === 'pen' ? '1.5px solid #ec4899' : '1px solid transparent',
            color: effectiveTool === 'pen' ? '#ec4899' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 700,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
          <span>Draw</span>
        </button>

        {/* Drag Canvas / Pan Tool */}
        <button
          type="button"
          title="Drag Canvas / Pan View (H or Hold Spacebar)"
          onClick={() => setActiveTool('hand')}
          style={{
            padding: '6px 10px',
            borderRadius: '8px',
            backgroundColor: effectiveTool === 'hand' ? '#fdf2f8' : 'transparent',
            border: effectiveTool === 'hand' ? '1.5px solid #ec4899' : '1px solid transparent',
            color: effectiveTool === 'hand' ? '#ec4899' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 700,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
            <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
            <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
          </svg>
          <span>Drag Canvas</span>
          <span style={{ fontSize: '10px', opacity: 0.65, backgroundColor: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: '4px' }}>Space</span>
        </button>

        {/* Eraser Tool */}
        <button
          type="button"
          title="Eraser (E)"
          onClick={() => setActiveTool('eraser')}
          style={{
            padding: '6px 10px',
            borderRadius: '8px',
            backgroundColor: effectiveTool === 'eraser' ? '#fdf2f8' : 'transparent',
            border: effectiveTool === 'eraser' ? '1.5px solid #ec4899' : '1px solid transparent',
            color: effectiveTool === 'eraser' ? '#ec4899' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 700,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
            <path d="M22 21H7" /><path d="m5 11 9 9" />
          </svg>
          <span>Eraser</span>
        </button>

        {/* Colors Palette */}
        {effectiveTool === 'pen' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 4px' }}>
            {[
              { val: '#1e293b', label: 'Dark Charcoal' },
              { val: '#ec4899', label: 'Hot Pink' },
              { val: '#3b82f6', label: 'Electric Blue' },
              { val: '#10b981', label: 'Emerald' },
              { val: '#f59e0b', label: 'Amber' },
              { val: '#8b5cf6', label: 'Purple' },
            ].map((c) => (
              <button
                key={c.val}
                type="button"
                title={c.label}
                onClick={() => setColor(c.val)}
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: c.val,
                  border: color === c.val ? '2.5px solid #ffffff' : '1.5px solid rgba(0,0,0,0.1)',
                  boxShadow: color === c.val ? `0 0 0 2px ${c.val}` : 'none',
                  transform: color === c.val ? 'scale(1.2)' : 'scale(1)',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.12s ease',
                }}
              />
            ))}
          </div>
        )}

        {/* Thickness Options */}
        {effectiveTool === 'pen' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            {[
              { size: 2, label: 'Fine' },
              { size: 4, label: 'Medium' },
              { size: 8, label: 'Bold' },
            ].map((th) => (
              <button
                key={th.size}
                type="button"
                title={th.label}
                onClick={() => setThickness(th.size)}
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '6px',
                  backgroundColor: thickness === th.size ? '#fdf2f8' : 'transparent',
                  border: thickness === th.size ? '1px solid #f472b6' : '1px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <div
                  style={{
                    width: `${Math.min(12, th.size + 4)}px`,
                    height: `${Math.min(12, th.size + 4)}px`,
                    borderRadius: '50%',
                    backgroundColor: color,
                  }}
                />
              </button>
            ))}
          </div>
        )}

        <div style={{ width: '1px', height: '22px', backgroundColor: 'rgba(225, 205, 215, 0.6)' }} />

        {/* Undo */}
        <button
          type="button"
          title="Undo (Ctrl+Z)"
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'transparent',
            color: undoStack.length > 0 ? '#475569' : '#cbd5e1',
            cursor: undoStack.length > 0 ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </svg>
        </button>

        {/* Redo */}
        <button
          type="button"
          title="Redo (Ctrl+Y)"
          onClick={handleRedo}
          disabled={redoStack.length === 0}
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'transparent',
            color: redoStack.length > 0 ? '#475569' : '#cbd5e1',
            cursor: redoStack.length > 0 ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
          </svg>
        </button>

        {/* Clear */}
        <button
          type="button"
          title="Clear Canvas"
          onClick={handleClear}
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="hover:text-red-500"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          </svg>
        </button>

        <div style={{ width: '1px', height: '22px', backgroundColor: 'rgba(225, 205, 215, 0.6)' }} />

        {/* Zoom Controls */}
        <button
          type="button"
          title="Zoom Out"
          onClick={() => setZoom((z) => Math.max(0.25, z * 0.85))}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'transparent',
            color: '#475569',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 700,
          }}
        >
          -
        </button>
        <button
          type="button"
          title="Reset Zoom & Pan (100%)"
          onClick={handleResetView}
          style={{
            padding: '2px 6px',
            borderRadius: '6px',
            border: '1px solid rgba(225, 205, 215, 0.6)',
            backgroundColor: '#ffffff',
            color: '#475569',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 700,
          }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          title="Zoom In"
          onClick={() => setZoom((z) => Math.min(4, z * 1.15))}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'transparent',
            color: '#475569',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 700,
          }}
        >
          +
        </button>

        <div style={{ width: '1px', height: '22px', backgroundColor: 'rgba(225, 205, 215, 0.6)' }} />

        {/* Close / Exit Fullscreen */}
        <button
          type="button"
          title="Exit Full Screen (Esc)"
          onClick={onClose}
          style={{
            padding: '6px 14px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #f43f5e 0%, #ec4899 100%)',
            color: '#ffffff',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 700,
            boxShadow: '0 4px 12px rgba(236, 72, 153, 0.35)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 14 10 14 10 20" />
            <polyline points="20 10 14 10 14 4" />
            <line x1="14" y1="10" x2="21" y2="3" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
          <span>Done</span>
        </button>
      </div>

      {/* Full-Screen Interactive Drawing and Panning SVG Canvas */}
      <svg
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          width: '100vw',
          height: '100vh',
          touchAction: 'none',
          cursor: effectiveTool === 'hand'
            ? (isPanning ? 'grabbing' : 'grab')
            : (effectiveTool === 'eraser' ? 'cell' : 'crosshair'),
        }}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {localStrokes.map((s) => (
            <path
              key={s.id}
              d={pointsToSvgPath(s.points, s.thickness || 3)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.thickness || 3}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.95}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}

/**
 * Canvas Note Node Component:
 * An interactive drawing canvas node where users can draw, sketch, and scribble directly,
 * drag the node across the board, or expand into a Full-Screen Draggable Canvas.
 */
function NoteNodeComponent({ shape }: { shape: NoteNodeShape }) {
  const editor = useEditor();
  const currentW = shape.props.w || DEFAULT_NOTE_WIDTH;
  const currentH = shape.props.h || DEFAULT_NOTE_HEIGHT;

  const [title, setTitle] = useState(shape.props.title || 'Canvas Note');
  const [color, setColor] = useState<'#1e293b' | '#ec4899' | '#3b82f6' | 'eraser'>('#1e293b');
  const [strokes, setStrokes] = useState<NoteStroke[]>(shape.props.drawings || []);
  const [isHovered, setIsHovered] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    setTitle(shape.props.title || 'Canvas Note');
  }, [shape.props.title]);

  useEffect(() => {
    setStrokes(shape.props.drawings || []);
  }, [shape.props.drawings]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    (editor as any).updateShape({
      id: shape.id,
      type: 'note-node',
      props: { title: val },
    });
  };

  const handleClearStrokes = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStrokes([]);
    (editor as any).updateShape({
      id: shape.id,
      type: 'note-node',
      props: { drawings: [] },
    });
  };

  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<{ x: number; y: number }[]>([]);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.stopPropagation();
    e.preventDefault();
    (e.nativeEvent as any)?.stopImmediatePropagation?.();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    isDrawingRef.current = true;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    currentPointsRef.current = [{ x, y }];

    const strokeColor = color === 'eraser' ? '#ffffff' : color;
    const strokeThickness = color === 'eraser' ? 18 : 3;

    const newStroke: NoteStroke = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      color: strokeColor,
      size: strokeThickness,
      thickness: strokeThickness,
      dash: 'draw',
      fill: 'none',
      points: [{ x, y }],
    };

    setStrokes((prev) => [...prev, newStroke]);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    currentPointsRef.current.push({ x, y });

    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      const last = { ...prev[prev.length - 1], points: [...currentPointsRef.current] };
      return [...prev.slice(0, -1), last];
    });
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingRef.current) return;
    e.stopPropagation();
    isDrawingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    setStrokes((finalStrokes) => {
      (editor as any).updateShape({
        id: shape.id,
        type: 'note-node',
        props: { drawings: finalStrokes },
      });
      return finalStrokes;
    });
  };

  return (
    <HTMLContainer style={{ pointerEvents: 'all', overflow: 'visible' }}>
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: currentW,
          height: currentH,
          borderRadius: '18px',
          backgroundColor: '#ffffff',
          border: isHovered
            ? '2px solid rgba(244, 114, 182, 0.7)'
            : '1.5px solid rgba(225, 205, 215, 0.65)',
          boxShadow: isHovered
            ? '0 16px 36px -6px rgba(244, 114, 182, 0.22), 0 4px 12px -2px rgba(0, 0, 0, 0.06)'
            : '0 8px 24px -4px rgba(244, 114, 182, 0.12), 0 2px 6px -1px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflow: 'hidden',
          transition: 'width 0.2s ease, height 0.2s ease, box-shadow 0.15s ease',
        }}
      >
        {/* Canvas Note Header: Drag Handle + Title + Pen Colors + Eraser + Clear + Fullscreen + Delete */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 10px',
            borderBottom: '1px solid rgba(225, 205, 215, 0.45)',
            backgroundColor: 'rgba(255, 250, 252, 0.95)',
            boxSizing: 'border-box',
            flexShrink: 0,
            gap: '6px',
            cursor: 'grab',
          }}
          title="Drag header to move node on board"
        >
          {/* Drag Handle Icon (bubbles pointer event to Tldraw for effortless dragging) */}
          <div style={{ display: 'flex', alignItems: 'center', color: '#cbd5e1', padding: '0 2px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
              <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
            </svg>
          </div>

          {/* Editable Note Title */}
          <input
            type="text"
            value={title}
            placeholder="Canvas Note"
            onChange={(e) => handleTitleChange(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            style={{
              flex: 1,
              fontSize: '12px',
              fontWeight: 700,
              color: '#1e293b',
              fontFamily: "'Manrope', sans-serif",
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: '2px 4px',
              margin: '0',
              minWidth: 0,
              borderRadius: '4px',
              cursor: 'text',
            }}
            className="focus:bg-white/70 focus:ring-1 focus:ring-pink-300 transition-colors"
          />

          {/* Drawing Tools: Dark, Pink, Blue, Eraser, Clear, Fullscreen Expand, Delete */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            {/* Dark Pen */}
            <button
              type="button"
              title="Black Pen"
              onClick={(e) => {
                e.stopPropagation();
                setColor('#1e293b');
              }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#1e293b',
                border: color === '#1e293b' ? '2px solid #ec4899' : '1.5px solid #cbd5e1',
                transform: color === '#1e293b' ? 'scale(1.15)' : 'scale(1)',
                cursor: 'pointer',
                padding: 0,
              }}
            />
            {/* Pink Pen */}
            <button
              type="button"
              title="Pink Pen"
              onClick={(e) => {
                e.stopPropagation();
                setColor('#ec4899');
              }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#ec4899',
                border: color === '#ec4899' ? '2px solid #1e293b' : '1.5px solid #fbcfe8',
                transform: color === '#ec4899' ? 'scale(1.15)' : 'scale(1)',
                cursor: 'pointer',
                padding: 0,
              }}
            />
            {/* Blue Pen */}
            <button
              type="button"
              title="Blue Pen"
              onClick={(e) => {
                e.stopPropagation();
                setColor('#3b82f6');
              }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                border: color === '#3b82f6' ? '2px solid #1e293b' : '1.5px solid #bfdbfe',
                transform: color === '#3b82f6' ? 'scale(1.15)' : 'scale(1)',
                cursor: 'pointer',
                padding: 0,
              }}
            />
            {/* Eraser */}
            <button
              type="button"
              title="Eraser"
              onClick={(e) => {
                e.stopPropagation();
                setColor('eraser');
              }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '4px',
                backgroundColor: color === 'eraser' ? '#fdf2f8' : 'transparent',
                border: color === 'eraser' ? '1.5px solid #ec4899' : '1px solid rgba(225, 205, 215, 0.45)',
                color: color === 'eraser' ? '#ec4899' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
                <path d="M22 21H7" /><path d="m5 11 9 9" />
              </svg>
            </button>
            {/* Clear strokes */}
            <button
              type="button"
              title="Clear Canvas"
              onClick={handleClearStrokes}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(225, 205, 215, 0.45)',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
              }}
              className="hover:text-red-500 hover:border-red-300"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              </svg>
            </button>

            {/* Expand into Full-Screen Mode */}
            <button
              type="button"
              title="Expand to Full Screen Canvas"
              onClick={(e) => {
                e.stopPropagation();
                setIsFullScreen(true);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '5px',
                backgroundColor: 'rgba(236, 72, 153, 0.12)',
                border: '1px solid rgba(244, 114, 182, 0.45)',
                color: '#ec4899',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                transition: 'all 0.15s ease',
              }}
              className="hover:bg-pink-200 hover:scale-105 active:scale-95"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>

            {/* Delete Node */}
            <button
              type="button"
              title="Delete Note"
              onClick={(e) => {
                e.stopPropagation();
                editor.deleteShapes([shape.id]);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(225, 205, 215, 0.45)',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
              }}
              className="hover:text-red-500 hover:border-red-300"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Small Node Drawing Surface */}
        <div
          style={{
            position: 'relative',
            flex: 1,
            width: '100%',
            backgroundColor: '#fdfcfe',
            backgroundImage: 'radial-gradient(circle, rgba(244, 114, 182, 0.22) 1px, transparent 1px)',
            backgroundSize: '16px 16px',
            overflow: 'hidden',
            cursor: color === 'eraser' ? 'cell' : 'crosshair',
          }}
        >
          <svg
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              touchAction: 'none',
              userSelect: 'none',
            }}
          >
            {strokes.map((s) => (
              <path
                key={s.id}
                d={pointsToSvgPath(s.points, s.thickness || 3)}
                fill="none"
                stroke={s.color}
                strokeWidth={s.thickness || 3}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.95}
              />
            ))}
          </svg>
        </div>
      </div>

      {/* Full-Screen Drawing Canvas Portal */}
      {isFullScreen &&
        createPortal(
          <FullScreenCanvasNoteModal
            title={title}
            onTitleChange={handleTitleChange}
            strokes={strokes}
            onSaveStrokes={(newStrokes) => {
              setStrokes(newStrokes);
              (editor as any).updateShape({
                id: shape.id,
                type: 'note-node',
                props: { drawings: newStrokes },
              });
            }}
            onClose={() => setIsFullScreen(false)}
          />,
          document.body
        )}
    </HTMLContainer>
  );
}

/**
 * Custom ShapeUtil for Note Node (Canvas drawing note):
 */
export class NoteNodeShapeUtil extends BaseBoxShapeUtil<any> {
  static override type = 'note-node' as const;

  override canResize(_shape: NoteNodeShape) {
    return true;
  }

  override hideRotateHandle(_shape: NoteNodeShape) {
    return true;
  }

  override hideSelectionBoundsFg(_shape: NoteNodeShape) {
    return true;
  }

  override hideSelectionBoundsBg(_shape: NoteNodeShape) {
    return true;
  }

  override getIndicatorPath(_shape: NoteNodeShape) {
    return undefined;
  }

  override getDefaultProps(): NoteNodeShape['props'] {
    return {
      w: DEFAULT_NOTE_WIDTH,
      h: DEFAULT_NOTE_HEIGHT,
      title: 'Canvas Note',
      content: '',
      color: '#fffdfa',
      drawings: [],
      innerShapes: [],
      isExpanded: false,
    };
  }

  override getGeometry(shape: NoteNodeShape) {
    return new Rectangle2d({
      width: Math.max(MIN_NOTE_WIDTH, shape.props?.w || DEFAULT_NOTE_WIDTH),
      height: Math.max(MIN_NOTE_HEIGHT, shape.props?.h || DEFAULT_NOTE_HEIGHT),
      isFilled: true,
    });
  }

  override component(shape: NoteNodeShape) {
    return <NoteNodeComponent shape={shape} />;
  }
}

/**
 * SimpleNoteNodeComponent:
 * Clean lined notebook page node with spiral clips along top edge,
 * editable "Notes" title, expand/collapse button, delete button,
 * 28px repeating ruled notebook lines, 42px pink vertical margin line,
 * directly typable textarea with debounced saving (no focus loss, no cursor jumping),
 * and corner dot matrix.
 */
export function SimpleNoteNodeComponent({ shape }: { shape: SimpleNoteNodeShape }) {
  const editor = useEditor();
  const [title, setTitle] = useState(shape.props.title || 'Notes');
  const [content, setContent] = useState(shape.props.content || '');
  const [isHovered, setIsHovered] = useState(false);
  const debounceRef = useRef<any>(null);
  const isExpanded = Boolean(shape.props.isExpanded);

  useEffect(() => {
    setTitle(shape.props.title || 'Notes');
  }, [shape.props.title]);

  useEffect(() => {
    if (shape.props.content !== undefined && shape.props.content !== content) {
      setContent(shape.props.content || '');
    }
  }, [shape.props.content]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    (editor as any).updateShape({
      id: shape.id,
      type: 'simple-note-node',
      props: { title: newTitle },
    });
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      (editor as any).updateShape({
        id: shape.id,
        type: 'simple-note-node',
        props: { content: val },
      });
    }, 250);
  };

  const handleBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    (editor as any).updateShape({
      id: shape.id,
      type: 'simple-note-node',
      props: { content },
    });
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextExpanded = !isExpanded;
    const targetW = nextExpanded ? SIMPLE_NOTE_EXPANDED_WIDTH : SIMPLE_NOTE_WIDTH;
    const targetH = nextExpanded ? SIMPLE_NOTE_EXPANDED_HEIGHT : SIMPLE_NOTE_HEIGHT;
    (editor as any).updateShape({
      id: shape.id,
      type: 'simple-note-node',
      props: {
        isExpanded: nextExpanded,
        w: targetW,
        h: targetH,
      },
    });
  };

  const currentW = shape.props.w || SIMPLE_NOTE_WIDTH;
  const currentH = shape.props.h || SIMPLE_NOTE_HEIGHT;
  const clipCount = Math.max(6, Math.floor((currentW - 32) / 30));

  return (
    <HTMLContainer style={{ pointerEvents: 'all', overflow: 'visible' }}>
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          position: 'relative',
          width: currentW,
          height: currentH,
          borderRadius: '18px',
          backgroundColor: '#ffffff',
          border: isHovered
            ? '2px solid rgba(244, 114, 182, 0.7)'
            : '1.5px solid rgba(225, 205, 215, 0.65)',
          boxShadow: isHovered
            ? '0 16px 36px -6px rgba(244, 114, 182, 0.22), 0 4px 12px -2px rgba(0, 0, 0, 0.06)'
            : '0 8px 24px -4px rgba(244, 114, 182, 0.12), 0 2px 6px -1px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflow: 'hidden',
          transition: 'width 0.2s ease, height 0.2s ease, box-shadow 0.15s ease',
        }}
      >
        {/* Spiral Notebook Ring Clips Along Top Edge */}
        <div
          style={{
            position: 'absolute',
            top: '-5px',
            left: '18px',
            right: '18px',
            display: 'flex',
            justifyContent: 'space-between',
            pointerEvents: 'none',
            zIndex: 20,
          }}
        >
          {Array.from({ length: clipCount }).map((_, i) => (
            <div
              key={i}
              style={{
                width: '10px',
                height: '14px',
                borderRadius: '5px',
                background: 'linear-gradient(180deg, #d1d5db 0%, #9ca3af 50%, #4b5563 100%)',
                boxShadow: '0 2px 3px rgba(0, 0, 0, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.8)',
                border: '0.5px solid rgba(0, 0, 0, 0.15)',
              }}
            />
          ))}
        </div>

        {/* Header: Title + Expand Button + Delete Button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px 6px 14px',
            borderBottom: '1.5px solid rgba(244, 114, 182, 0.3)',
            backgroundColor: 'rgba(255, 250, 252, 0.85)',
            boxSizing: 'border-box',
            flexShrink: 0,
            gap: '8px',
          }}
        >
          <input
            type="text"
            value={title}
            placeholder="Notes"
            onChange={(e) => handleTitleChange(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            style={{
              flex: 1,
              fontSize: '13px',
              fontWeight: 700,
              color: '#272224',
              fontFamily: "'Manrope', sans-serif",
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: '2px 4px',
              margin: '0',
              minWidth: 0,
              borderRadius: '4px',
              cursor: 'text',
            }}
            className="focus:bg-white/60 focus:ring-1 focus:ring-pink-300 transition-colors"
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Expand / Shrink Button */}
            <button
              type="button"
              title={isExpanded ? 'Collapse size' : 'Expand size'}
              onClick={handleToggleExpand}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '6px',
                backgroundColor: 'rgba(236, 72, 153, 0.12)',
                border: '1px solid rgba(244, 114, 182, 0.35)',
                color: '#ec4899',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
              }}
              className="hover:scale-110 active:scale-95 hover:bg-pink-100 hover:border-pink-400"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                {isExpanded ? (
                  <>
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </>
                ) : (
                  <>
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </>
                )}
              </svg>
            </button>

            {/* Delete Node Button */}
            <button
              type="button"
              title="Delete Note"
              onClick={(e) => {
                e.stopPropagation();
                editor.deleteShapes([shape.id]);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(225, 205, 215, 0.45)',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
              }}
              className="hover:text-red-500 hover:border-red-300"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Notebook Body: Repeating ruled lines + vertical pink margin line + textarea */}
        <div
          style={{
            position: 'relative',
            flex: 1,
            width: '100%',
            overflow: 'hidden',
            background: 'repeating-linear-gradient(to bottom, transparent, transparent 27px, rgba(244, 114, 182, 0.28) 27px, rgba(244, 114, 182, 0.28) 28px)',
          }}
        >
          {/* Vertical Pink Margin Line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: '42px',
              width: '1px',
              backgroundColor: 'rgba(244, 114, 182, 0.45)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />

          {/* Typable Textarea: direct typing, debounced save, NO focus stealing */}
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            onBlur={handleBlur}
            placeholder="Write your note here..."
            spellCheck={false}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              (e.nativeEvent as any)?.stopImmediatePropagation?.();
            }}
            onKeyUp={(e) => {
              e.stopPropagation();
              (e.nativeEvent as any)?.stopImmediatePropagation?.();
            }}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              padding: '0 16px 12px 50px',
              lineHeight: '28px',
              fontSize: '14px',
              fontFamily: '"Outfit", "Inter", -apple-system, sans-serif',
              color: '#334155',
              caretColor: '#ec4899',
              boxSizing: 'border-box',
              overflowY: 'auto',
              zIndex: 2,
            }}
          />

          {/* Corner Dot Grid Watermark (6 Pink Dots in Triangle) */}
          <div
            style={{
              position: 'absolute',
              bottom: '6px',
              right: '6px',
              padding: '4px',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.75,
              pointerEvents: 'none',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="10" cy="10" r="1.15" fill="#f472b6" />
              <circle cx="6" cy="10" r="1.15" fill="#f472b6" />
              <circle cx="2" cy="10" r="1.15" fill="#f472b6" />
              <circle cx="10" cy="6" r="1.15" fill="#f472b6" />
              <circle cx="6" cy="6" r="1.15" fill="#f472b6" />
              <circle cx="10" cy="2" r="1.15" fill="#f472b6" />
            </svg>
          </div>
        </div>
      </div>
    </HTMLContainer>
  );
}

/**
 * Custom ShapeUtil for Simple Note Node (Lined notebook page):
 */
export class SimpleNoteNodeShapeUtil extends BaseBoxShapeUtil<any> {
  static override type = 'simple-note-node' as const;

  override canResize(_shape: SimpleNoteNodeShape) {
    return true;
  }

  override hideRotateHandle(_shape: SimpleNoteNodeShape) {
    return true;
  }

  override hideSelectionBoundsFg(_shape: SimpleNoteNodeShape) {
    return true;
  }

  override hideSelectionBoundsBg(_shape: SimpleNoteNodeShape) {
    return true;
  }

  override getIndicatorPath(_shape: SimpleNoteNodeShape) {
    return undefined;
  }

  override getDefaultProps(): SimpleNoteNodeShape['props'] {
    return {
      w: SIMPLE_NOTE_WIDTH,
      h: SIMPLE_NOTE_HEIGHT,
      title: 'Notes',
      content: '',
      color: '#ffffff',
      isExpanded: false,
      simpleNote: true,
    };
  }

  override getGeometry(shape: SimpleNoteNodeShape) {
    return new Rectangle2d({
      width: Math.max(200, shape.props.w || SIMPLE_NOTE_WIDTH),
      height: Math.max(200, shape.props.h || SIMPLE_NOTE_HEIGHT),
      isFilled: true,
    });
  }

  override component(shape: SimpleNoteNodeShape) {
    return <SimpleNoteNodeComponent shape={shape} />;
  }
}


const customShapeUtils = [MainNodeShapeUtil, LinkNodeShapeUtil, NoteNodeShapeUtil, SimpleNoteNodeShapeUtil, PersonNodeShapeUtil];

/**
 * Sets up automatic deletion of connected arrows whenever a node is deleted.
 * When ANY node (main-node, link-node, note-node, or any shape) is deleted,
 * all arrows connected to it (via bindings, props, or metadata) will automatically be deleted too.
 */
export function setupAutoDeleteConnectedArrows(editor: Editor): () => void {
  const arrowsPendingDelete = new Set<string>();
  let isDeleting = false;

  const deletePendingArrows = () => {
    if (isDeleting || arrowsPendingDelete.size === 0) return;
    const toDelete = Array.from(arrowsPendingDelete).filter((id) => {
      const s = editor.getShape(id as any);
      return s && s.type === 'arrow';
    });
    arrowsPendingDelete.clear();
    if (toDelete.length > 0) {
      isDeleting = true;
      try {
        editor.deleteShapes(toDelete as any);
      } catch (err) {
        console.warn('Failed to auto-delete connected arrows', err);
      } finally {
        isDeleting = false;
      }
    }
  };

  const cleanupBeforeDelete = editor.sideEffects.registerBeforeDeleteHandler('shape', (shape) => {
    // If the shape being deleted is already an arrow, we don't need to look for connected arrows
    if (shape.type === 'arrow') return;

    const shapeId = shape.id;

    // 1. Check bindings involving this shape
    try {
      const bindings =
        (editor as any).getBindingsInvolvingShape?.(shapeId) ||
        (editor as any).getBindingsToShape?.(shapeId);
      if (Array.isArray(bindings)) {
        for (const b of bindings) {
          if (b.type === 'arrow') {
            if (b.fromId && b.fromId !== shapeId) {
              const arrowShape = editor.getShape(b.fromId);
              if (arrowShape?.type === 'arrow') {
                arrowsPendingDelete.add(b.fromId);
              }
            }
            if (b.toId && b.toId !== shapeId) {
              const arrowShape = editor.getShape(b.toId);
              if (arrowShape?.type === 'arrow') {
                arrowsPendingDelete.add(b.toId);
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // 2. Check all arrow shapes on the canvas whose start/end props bind to this shape or match metadata
    try {
      const allArrows = editor.getCurrentPageShapes().filter((s: any) => s.type === 'arrow');
      for (const arrow of allArrows) {
        const startBound = (arrow.props as any)?.start?.boundShapeId;
        const endBound = (arrow.props as any)?.end?.boundShapeId;
        const metaStart = (arrow.meta as any)?.startNodeId;
        const metaEnd = (arrow.meta as any)?.endNodeId;

        if (
          startBound === shapeId ||
          endBound === shapeId ||
          metaStart === shapeId ||
          metaEnd === shapeId
        ) {
          arrowsPendingDelete.add(arrow.id);
        }
      }
    } catch {
      // ignore
    }

    // 3. Directly inspect any arrow bindings in store query
    try {
      const allBindings = (editor.store as any).query?.records?.('binding')?.get?.();
      if (Array.isArray(allBindings)) {
        for (const b of allBindings) {
          if (b.type === 'arrow' && (b.toId === shapeId || b.fromId === shapeId)) {
            if (b.fromId && b.fromId !== shapeId) {
              const arrowShape = editor.getShape(b.fromId);
              if (arrowShape?.type === 'arrow') {
                arrowsPendingDelete.add(b.fromId);
              }
            }
            if (b.toId && b.toId !== shapeId) {
              const arrowShape = editor.getShape(b.toId);
              if (arrowShape?.type === 'arrow') {
                arrowsPendingDelete.add(b.toId);
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // Schedule deletion in microtask if not already triggered by operation completion
    queueMicrotask(() => {
      deletePendingArrows();
    });
  });

  const cleanupAfterDelete = editor.sideEffects.registerAfterDeleteHandler('shape', (shape) => {
    if (shape.type === 'arrow') return;
    deletePendingArrows();
  });

  const cleanupOpComplete = editor.sideEffects.registerOperationCompleteHandler(() => {
    deletePendingArrows();
  });

  const cleanupStoreListener = editor.store.listen(() => {
    if (arrowsPendingDelete.size > 0) {
      deletePendingArrows();
    }
  });

  return () => {
    cleanupBeforeDelete();
    cleanupAfterDelete();
    cleanupOpComplete();
    cleanupStoreListener();
  };
}

/**
 * Custom Pink Grid Lines component for Tldraw.
 * Renders SVG grid lines that pan and zoom with the editor camera.
 */
function PinkGridLines({ x, y, z, size }: TLGridProps) {
  const id = useId();
  const s = (size || 32) * z;
  const xo = 0.5 + x * z;
  const yo = 0.5 + y * z;
  const gxo = xo > 0 ? xo % s : s + (xo % s);
  const gyo = yo > 0 ? yo % s : s + (yo % s);

  return (
    <svg
      className="tl-grid"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ pointerEvents: 'none' }}
    >
      <defs>
        <pattern
          id={id}
          width={s}
          height={s}
          patternUnits="userSpaceOnUse"
          x={gxo}
          y={gyo}
        >
          <path
            d={`M ${s} 0 L 0 0 0 ${s}`}
            fill="none"
            stroke="#fbcfe8"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/**
 * Custom Canvas Background: lightest airy pink.
 */
function PinkCanvasBackground() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#fff5f8',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}

/**
 * Minimal tldraw components configuration:
 * Hides all unnecessary toolbars and menus while retaining tldraw's
 * built-in NavigationPanel (zoom-in, zoom-out, zoom menu, and minimap).
 */
const minimalCanvasComponents: TLComponents = {
  Toolbar: null,
  PageMenu: null,
  MainMenu: null,
  QuickActions: null,
  HelperButtons: null,
  DebugMenu: null,
  DebugPanel: null,
  MenuPanel: null,
  TopPanel: null,
  SharePanel: null,
  StylePanel: null,
  ActionsMenu: null,
  HelpMenu: null,
  FollowingIndicator: null,

  Background: PinkCanvasBackground,
  Grid: PinkGridLines,
};

export default function TldrawBoard({ cardId, cardTitle, cardColor, onBack }: TldrawBoardProps) {
  const editorRef = useRef<Editor | null>(null);
  const effectiveId = cardId || 'card-1';
  const saveTimeoutRef = useRef<any>(null);
  const isLoadingRef = useRef(false);

  const flushSave = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || isLoadingRef.current) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    try {
      const snapshot = editor.getSnapshot();
      const allShapes = editor.getCurrentPageShapes();
      const nodes = allShapes
        .filter((s) => s.type !== 'arrow')
        .map((s) => {
          let nodeTitle = (s.props as any)?.title || (s.props as any)?.name;
          if (!nodeTitle) {
            const sType = (s as any).type;
            if (sType === 'link-node') {
              const links = (s.props as any)?.links;
              nodeTitle = Array.isArray(links) && links[0]?.url ? links[0].url : 'Link Node';
            } else if (sType === 'simple-note-node') {
              nodeTitle = (s.props as any)?.title || 'Notes';
            } else if (sType === 'note-node') {
              nodeTitle = (s.props as any)?.title || 'Note Node';
            } else if (sType === 'person-node') {
              nodeTitle = (s.props as any)?.name || 'Person Node';
            } else {
              nodeTitle = sType;
            }
          }
          return {
            id: s.id,
            title: nodeTitle,
            content: JSON.stringify(s.props),
            position_x: Math.round(s.x),
            position_y: Math.round(s.y),
            width: (s.props as any)?.w || 260,
            height: (s.props as any)?.h || 68,
            color: (s.props as any)?.color || '#EF3167',
          };
        });

      const validNodeIds = new Set(nodes.map((n) => n.id));
      const connections = allShapes
        .filter((s) => s.type === 'arrow')
        .map((s) => ({
          id: s.id,
          source_node_id: (s.meta as any)?.startNodeId || (s.props as any)?.start?.boundShapeId || '',
          target_node_id: (s.meta as any)?.endNodeId || (s.props as any)?.end?.boundShapeId || '',
        }))
        .filter((c) => validNodeIds.has(c.source_node_id) && validNodeIds.has(c.target_node_id));

      const res = await fetch(`/api/workspaces/${effectiveId}/board`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot, nodes, connections }),
      });
      if (!res.ok) {
        console.warn('Auto-save response not ok:', res.status);
        window.dispatchEvent(new CustomEvent('db-save-status', { detail: 'error' }));
        return;
      }
      window.dispatchEvent(new CustomEvent('db-save-status', { detail: 'saved' }));
    } catch (e) {
      console.warn('Auto-save to DB failed:', e);
      window.dispatchEvent(new CustomEvent('db-save-status', { detail: 'error' }));
    }
  }, [effectiveId]);

  const handleBackClick = async () => {
    await flushSave();
    onBack?.();
  };

  useEffect(() => {
    return () => {
      flushSave();
    };
  }, [flushSave]);

  // Ensure built-in minimap starts expanded if not set
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('minimap') === null) {
      localStorage.setItem('minimap', JSON.stringify(false));
    }
  }, []);

  // Directly creates the Main Node without overlapping existing nodes
  const handleCreateNode = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const defaultTitle = 'Main Node';
    const w = computeMainNodeWidth(defaultTitle, formattedDate);
    const h = MAIN_NODE_HEIGHT;

    const center = editor.getViewportPageBounds().center;
    const preferredX = Math.round(center.x - w / 2);
    const preferredY = Math.round(center.y - h / 2);

    const { x: finalX, y: finalY } = findNonOverlappingPosition(
      editor,
      { x: preferredX, y: preferredY, w, h },
      { preferredDirection: 'spiral', margin: 40 }
    );

    const shapeId = createShapeId();
    (editor as any).createShape({
      id: shapeId,
      type: 'main-node',
      x: finalX,
      y: finalY,
      props: {
        w,
        h,
        title: defaultTitle,
        date: formattedDate,
        color: cardColor || '#EF3167',
      },
    });

    editor.select(shapeId);
  }, [cardColor]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1000,
        backgroundColor: '#fff5f8',
      }}
    >
      <style>{`
        /* Canvas base styles */
        .tl-container {
          background-color: #fff5f8 !important;
          --color-background: #fff5f8 !important;
          --tl-color-background: #fff5f8 !important;
        }

        /* Hide tldraw's default sharp blue wireframe selection box on shapes */
        .tl-selection__bounds,
        .tl-selection__bounds__bg,
        .tl-selection__indicator {
          display: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }

        /* Tldraw Built-in Navigation Panel (Zoom controls + Minimap) */
        .tlui-navigation-panel {
          position: fixed !important;
          bottom: 24px !important;
          right: 24px !important;
          left: auto !important;
          z-index: 999 !important;
          display: flex !important;
          flex-direction: column !important;
          border-radius: 20px !important;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(250, 244, 246, 0.88) 50%, rgba(242, 234, 238, 0.82) 100%) !important;
          border: 1px solid rgba(225, 205, 215, 0.5) !important;
          backdrop-filter: blur(24px) saturate(160%) !important;
          -webkit-backdrop-filter: blur(24px) saturate(160%) !important;
          box-shadow: 0 8px 24px -4px rgba(244, 114, 182, 0.12), 0 2px 6px -1px rgba(0, 0, 0, 0.04), inset 0 1px 1.5px 0 rgba(255, 255, 255, 1) !important;
          overflow: hidden !important;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }

        /* Remove default grey background wedge */
        .tlui-navigation-panel::before {
          display: none !important;
        }

        /* Navigation toolbar containing the buttons */
        .tlui-navigation-panel .tlui-toolbar {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 5px 8px !important;
          gap: 4px !important;
          display: flex !important;
          align-items: center !important;
        }

        /* Design system rounded icon buttons */
        .tlui-navigation-panel .tlui-button {
          border-radius: 9999px !important;
          color: #272224 !important;
          background: transparent !important;
          transition: all 0.15s ease !important;
        }

        .tlui-navigation-panel .tlui-button:hover {
          background: rgba(244, 114, 182, 0.15) !important;
          color: #be185d !important;
        }

        .tlui-navigation-panel .tlui-button:active {
          transform: scale(0.95) !important;
        }

        /* Zoom percentage dropdown trigger button */
        .tlui-navigation-panel .tlui-zoom-menu__button {
          border-radius: 9999px !important;
          font-family: 'Manrope', sans-serif !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          color: #272224 !important;
          padding: 4px 10px !important;
          background: rgba(255, 255, 255, 0.6) !important;
          border: 1px solid rgba(225, 205, 215, 0.45) !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04) !important;
        }

        .tlui-navigation-panel .tlui-zoom-menu__button:hover {
          background: rgba(244, 114, 182, 0.15) !important;
          color: #be185d !important;
        }

        /* Built-in Minimap (the little map) */
        .tlui-minimap {
          background: rgba(255, 245, 248, 0.75) !important;
          border-top: 1px solid rgba(225, 205, 215, 0.5) !important;
          padding: 8px !important;
          min-height: 100px !important;
        }

        .tlui-minimap__canvas {
          border-radius: 12px !important;
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05) !important;
        }

        /* Frosted Glass Dropdown Menu for Zoom presets */
        .tlui-menu,
        .tlui-popover__content {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(250, 244, 246, 0.92) 100%) !important;
          border: 1px solid rgba(225, 205, 215, 0.55) !important;
          backdrop-filter: blur(24px) saturate(160%) !important;
          -webkit-backdrop-filter: blur(24px) saturate(160%) !important;
          border-radius: 14px !important;
          box-shadow: 0 12px 32px -4px rgba(244, 114, 182, 0.14), 0 4px 12px rgba(0, 0, 0, 0.06), inset 0 1px 1.5px rgba(255, 255, 255, 1) !important;
          color: #272224 !important;
          font-family: 'Manrope', sans-serif !important;
        }

        .tlui-menu__button,
        .tlui-menu__item {
          border-radius: 8px !important;
          color: #272224 !important;
          font-family: 'Manrope', sans-serif !important;
          font-size: 12px !important;
          font-weight: 600 !important;
        }

        .tlui-menu__button:hover,
        .tlui-menu__item:hover,
        .tlui-menu__button[data-highlighted='true'],
        .tlui-menu__item[data-highlighted='true'] {
          background: rgba(244, 114, 182, 0.14) !important;
          color: #be185d !important;
        }

        /* Tldraw Style Panel inside Note Header */
        .note-tldraw-style-panel .tlui-style-panel {
          position: static !important;
          box-shadow: 0 16px 40px -8px rgba(0, 0, 0, 0.16), 0 4px 14px rgba(0, 0, 0, 0.08) !important;
          border-radius: 16px !important;
          border: 1px solid rgba(225, 205, 215, 0.7) !important;
          background: #ffffff !important;
          padding: 12px !important;
          width: 200px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 10px !important;
        }

        /* 4 Colors: black, red, blue, green */
        .note-tldraw-style-panel [data-testid^="style.color."]:not([data-testid="style.color.black"]):not([data-testid="style.color.red"]):not([data-testid="style.color.blue"]):not([data-testid="style.color.green"]) {
          display: none !important;
        }
        .note-tldraw-style-panel [data-testid="style.color"] {
          display: grid !important;
          grid-template-columns: repeat(4, 1fr) !important;
          gap: 6px !important;
        }

        /* Opacity/Thickness Slider */
        .note-tldraw-style-panel [data-testid="style.opacity"] {
          margin: 4px 0 !important;
        }

        /* Fill: none and pattern */
        .note-tldraw-style-panel [data-testid^="style.fill."]:not([data-testid="style.fill.none"]):not([data-testid="style.fill.pattern"]),
        .note-tldraw-style-panel [data-testid="fill-extra"],
        .note-tldraw-style-panel [data-testid="style.fill-extra"] {
          display: none !important;
        }

        /* Dash: draw */
        .note-tldraw-style-panel [data-testid^="style.dash."]:not([data-testid="style.dash.draw"]) {
          display: none !important;
        }

        /* Size: small (s) and medium (m) only */
        .note-tldraw-style-panel [data-testid="style.size.l"],
        .note-tldraw-style-panel [data-testid="style.size.xl"] {
          display: none !important;
        }
      `}</style>

      {/* Sleek Frosted Glass Breadcrumb/Back Button */}
      <button
        type="button"
        onClick={handleBackClick}
        title="Back to Collection"
        style={{
          position: 'fixed',
          top: '24px',
          left: '24px',
          zIndex: 9999,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 18px',
          borderRadius: '9999px',
          background:
            'linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(250, 244, 246, 0.88) 50%, rgba(242, 234, 238, 0.82) 100%)',
          border: '1px solid rgba(225, 205, 215, 0.5)',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          boxShadow:
            '0 8px 24px -4px rgba(244, 114, 182, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04), inset 0 1px 1.5px 0 rgba(255, 255, 255, 1)',
          cursor: 'pointer',
          color: '#272224',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: "'Manrope', sans-serif",
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          userSelect: 'none',
        }}
        className="hover:scale-105 active:scale-95"
      >
        <svg
          style={{ width: '16px', height: '16px' }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        <span>Collection</span>
        <span style={{ color: '#a1a1aa', fontSize: '11px', margin: '0 2px' }}>/</span>
        <span style={{ color: '#be185d', fontWeight: 700 }}>{cardTitle}</span>
      </button>

      {/* Floating Action Sidebar: Directly creates Main Node on click with zero color steps */}
      <div
        style={{
          position: 'fixed',
          left: '30px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
          userSelect: 'none',
          pointerEvents: 'auto',
        }}
      >
        <LiquidGlassButton
          onClick={handleCreateNode}
          title="Create Main Node"
          aria-label="Add Main Node"
          disableActive={true}
        />
      </div>

      {/* Database Connection Status: Left side down corner */}
      <DatabaseStatusBadge />

      {/* Pure Tldraw Canvas with custom MainNode shape util */}
      <Tldraw
        shapeUtils={customShapeUtils}
        components={minimalCanvasComponents}
        onMount={(editor) => {
          editorRef.current = editor;
          setupAutoDeleteConnectedArrows(editor);
          editor.updateInstanceState({ isGridMode: true });

          // 1. Fetch saved board snapshot from Cloudflare D1
          (async () => {
            isLoadingRef.current = true;
            try {
              const res = await fetch(`/api/workspaces/${effectiveId}/board`);
              if (res.ok) {
                const data = await res.json();
                let snapshotLoaded = false;
                if (
                  data &&
                  data.snapshot &&
                  typeof data.snapshot === 'object' &&
                  (data.snapshot.document || data.snapshot.schema || data.snapshot.store)
                ) {
                  try {
                    const snap = { ...data.snapshot };
                    if (snap.document && !snap.document.schema && snap.schema) {
                      snap.document = { ...snap.document, schema: snap.schema };
                    }
                    editor.loadSnapshot(snap);
                    snapshotLoaded = true;
                  } catch (snapErr) {
                    console.warn('Failed to load snapshot into editor:', snapErr);
                  }
                }
                if (!snapshotLoaded && data && Array.isArray(data.nodes) && data.nodes.length > 0) {
                  // Fallback: reconstruct shapes from relational nodes table
                  for (const n of data.nodes) {
                    try {
                      const props = n.content ? JSON.parse(n.content) : {};
                      let shapeType = 'main-node';
                      if (n.id?.includes('link') || props.links) shapeType = 'link-node';
                      else if (n.id?.includes('simple-note') || props.simpleNote) shapeType = 'simple-note-node';
                      else if (n.id?.includes('note') || props.drawings) shapeType = 'note-node';
                      else if (n.id?.includes('person') || props.about) shapeType = 'person-node';

                      const baseProps: any = { ...props, w: n.width, h: n.height };
                      if (shapeType === 'main-node') {
                        baseProps.color = n.color || '#EF3167';
                        baseProps.title = n.title || 'Main Node';
                        baseProps.date = props.date || 'Oct 27, 2026';
                      } else if (shapeType === 'note-node') {
                        baseProps.title = n.title || props.title || 'Canvas Note';
                        baseProps.content = props.content || '';
                        baseProps.drawings = props.drawings || [];
                        baseProps.color = n.color || props.color || '#fffdfa';
                      } else if (shapeType === 'simple-note-node') {
                        baseProps.title = n.title || props.title || 'Notes';
                        baseProps.content = props.content || '';
                        baseProps.color = n.color || props.color || '#ffffff';
                        baseProps.simpleNote = true;
                      } else if (shapeType === 'person-node') {
                        baseProps.name = n.title || props.name || 'Person';
                        baseProps.about = props.about || '';
                        baseProps.links = props.links || [];
                      } else if (shapeType === 'link-node') {
                        baseProps.links = props.links || [];
                      }

                      (editor as any).createShape({
                        id: n.id,
                        type: shapeType,
                        x: n.position_x,
                        y: n.position_y,
                        props: baseProps,
                      });
                    } catch {
                      // ignore parse error
                    }
                  }
                }
              }
            } catch (err) {
              console.warn('Failed to load board snapshot from Cloudflare D1:', err);
            } finally {
              isLoadingRef.current = false;
            }

            // 2. If no shapes exist yet, automatically spawn an initial Main Node
            const shapes = editor.getCurrentPageShapes();
            if (shapes.length === 0) {
              const now = new Date();
              const formattedDate = now.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
              const center = editor.getViewportPageBounds().center;
              const shapeId = createShapeId();
              const initialTitle = cardTitle || 'Flowchart';
              const w = computeMainNodeWidth(initialTitle, formattedDate);
              (editor as any).createShape({
                id: shapeId,
                type: 'main-node',
                x: center.x - w / 2,
                y: center.y - MAIN_NODE_HEIGHT / 2,
                props: {
                  w,
                  h: MAIN_NODE_HEIGHT,
                  title: initialTitle,
                  date: formattedDate,
                  color: cardColor || '#EF3167',
                },
              });
            }
          })();

          // 3. Auto-save changes to Cloudflare D1 whenever the canvas is modified
          const saveBoardToDb = () => {
            if (isLoadingRef.current) return;
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            window.dispatchEvent(new CustomEvent('db-save-status', { detail: 'saving' }));
            saveTimeoutRef.current = setTimeout(async () => {
              await flushSave();
            }, 600);
          };

          const cleanup = editor.store.listen(saveBoardToDb);
          return () => {
            cleanup();
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
          };
        }}
      />
    </div>
  );
}
