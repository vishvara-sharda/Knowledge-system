import { useState, useEffect, useRef, useCallback } from 'react';
import { LiquidGlassButton } from './design-system';
import TldrawBoard from './components/TldrawBoard';
import { DatabaseStatusBadge } from './components/DatabaseStatusBadge';

/**
 * Solid white background with the signature pink grid line pattern.
 * Uses exact 32px grid pitch with soft pink (#fbcfe8) stroke lines.
 */
function PinkLineBackground() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#ffffff',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <svg
        width="100%"
        height="100%"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      >
        <defs>
          <pattern
            id="pink-line-canvas-pattern"
            width={32}
            height={32}
            patternUnits="userSpaceOnUse"
          >
            {/* Clean, soft pink grid lines */}
            <path
              d="M 32 0 L 0 0 0 32"
              fill="none"
              stroke="#fbcfe8"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pink-line-canvas-pattern)" />
      </svg>
    </div>
  );
}

interface CardColor {
  id: string;
  name: string;
  hex: string;
}

const CARD_COLORS: CardColor[] = [
  { id: 'pink', name: 'Pink', hex: '#EF3167' },
  { id: 'purple', name: 'Purple', hex: '#9C52CF' },
  { id: 'blue', name: 'Blue', hex: '#3B82F6' },
  { id: 'green', name: 'Green', hex: '#10B981' },
];

interface CollectionTabItem {
  id: string;
  title: string;
  date: string;
  color: string;
}

const singleCollectionCard: CollectionTabItem = {
  id: 'card-1',
  title: 'Flowchart',
  date: 'Created Oct 26, 2026',
  color: '#EF3167',
};

/**
 * Floating Liquid Glass Action Buttons (Plus & Collection) + Collection Heading & Card.
 * Sits floating on the canvas:
 * - Icons container: 30px from left, vertically centered in sidebar section
 * - Plus button on top, Collection button directly under it (50px x 50px each)
 * - Clear container with 'Collection' heading: top: 40px, left: 116px
 * - Single big collection card floating directly on screen under heading
 * - Linked to the Collection button (toggles on/off, visible by default)
 */
function FloatingActionButtons() {
  // Visible by default so the user sees the heading & card immediately
  const [showCollection, setShowCollection] = useState(true);
  const [collectionCards, setCollectionCards] = useState<CollectionTabItem[]>([singleCollectionCard]);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [colorPickerCardId, setColorPickerCardId] = useState<string | null>(null);
  const [showAddColorMenu, setShowAddColorMenu] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [activeBoardCard, setActiveBoardCard] = useState<CollectionTabItem | null>(null);
  const lastTapTimeRef = useRef<{ [cardId: string]: number }>({});

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/workspaces');
      if (res.ok) {
        const data = (await res.json()) as Array<{ id: string; name: string; color?: string; created_at: string }>;
        if (Array.isArray(data) && data.length > 0) {
          let cachedColors: Record<string, string> = {};
          try {
            cachedColors = JSON.parse(localStorage.getItem('workspace_colors') || '{}');
          } catch {}
          const defaultPalette = ['#EF3167', '#9C52CF', '#3B82F6', '#10B981'];
          setCollectionCards(
            data.map((ws, i) => {
              const assignedColor = ws.color || cachedColors[ws.id] || defaultPalette[i % defaultPalette.length];
              return {
                id: ws.id,
                title: ws.name,
                date: ws.created_at
                  ? new Date(ws.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Saved',
                color: assignedColor,
              };
            })
          );
        }
      }
    } catch (e) {
      console.warn('Failed to load workspaces from Cloudflare D1:', e);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Close color picker when clicking outside
  useEffect(() => {
    if (!colorPickerCardId) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.closest('.color-picker-popover') || target.closest('.color-edit-trigger'))) {
        return;
      }
      setColorPickerCardId(null);
    };
    const timer = setTimeout(() => {
      window.addEventListener('click', handleClickOutside);
    }, 10);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleClickOutside);
    };
  }, [colorPickerCardId]);

  // Close plus color menu when clicking outside
  useEffect(() => {
    if (!showAddColorMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('.add-tab-menu-trigger')) {
        return;
      }
      setShowAddColorMenu(false);
    };
    const timer = setTimeout(() => {
      window.addEventListener('click', handleClickOutside);
    }, 10);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleClickOutside);
    };
  }, [showAddColorMenu]);

  const updateCardColor = (id: string, newColor: string) => {
    // 1. Update React state immediately
    setCollectionCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, color: newColor } : c))
    );

    // 2. Persist to localStorage cache
    try {
      const cached = JSON.parse(localStorage.getItem('workspace_colors') || '{}');
      cached[id] = newColor;
      localStorage.setItem('workspace_colors', JSON.stringify(cached));
    } catch {}

    // 3. Persist to Cloudflare D1
    fetch(`/api/workspaces/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color: newColor }),
    }).catch((e) => console.warn('Failed to update workspace color in Cloudflare D1:', e));
  };

  const handleCreateCardWithColor = (chosenColor: string) => {
    const newId = `ws-${Date.now()}`;
    const cardIndex = collectionCards.length + 1;
    const sampleTitles = [
      'Wireframe',
      'Brainstorm',
      'System Architecture',
      'Product Spec',
      'Research Notes',
      'Moodboard',
      'User Journey',
    ];
    const safeIndex = (cardIndex - 1 + sampleTitles.length) % sampleTitles.length;
    const title = sampleTitles[safeIndex] || `Tab ${cardIndex}`;

    const newCard: CollectionTabItem = {
      id: newId,
      title,
      date: 'Created Just now',
      color: chosenColor,
    };

    setCollectionCards((prev) => [...prev, newCard]);
    setShowAddColorMenu(false);

    // Persist new workspace to Cloudflare D1
    fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: newId, name: title }),
    }).catch((e) => console.warn('Failed to save workspace to Cloudflare D1:', e));

    // Make sure collection is open so user sees the newly added tab
    if (!showCollection) {
      setShowCollection(true);
    }
  };

  const handleDeleteSingleCard = (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollectionCards((prev) => prev.filter((c) => c.id !== cardId));
    if (colorPickerCardId === cardId) {
      setColorPickerCardId(null);
    }
    fetch(`/api/workspaces/${cardId}`, { method: 'DELETE' }).catch((e) =>
      console.warn('Failed to delete workspace from Cloudflare D1:', e)
    );
  };

  const startEditing = (cardId: string, currentTitle: string) => {
    setEditingCardId(cardId);
    setEditingTitle(currentTitle);
  };

  const finishEditing = (cardId: string) => {
    if (editingTitle && editingTitle.trim()) {
      const cleanTitle = editingTitle.trim();
      setCollectionCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, title: cleanTitle } : c))
      );
      fetch(`/api/workspaces/${cardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanTitle }),
      }).catch((e) => console.warn('Failed to update workspace title in Cloudflare D1:', e));
    }
    setEditingCardId(null);
  };

  if (activeBoardCard) {
    return (
      <TldrawBoard
        cardId={activeBoardCard.id}
        cardTitle={activeBoardCard.title}
        cardColor={activeBoardCard.color}
        onBack={() => {
          setActiveBoardCard(null);
          fetchWorkspaces();
        }}
      />
    );
  }

  return (
    <>
      {/* 1. Floating Action Buttons (Plus & Collection) in the middle of the sidebar section */}
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
        {/* Plus Button (Creates Note) - 50px x 50px with 4 circular color choices */}
        <div style={{ position: 'relative' }}>
          <LiquidGlassButton
            onClick={(e) => {
              e.stopPropagation();
              setShowAddColorMenu((prev) => !prev);
            }}
            title="Create new tab"
            aria-label="Add Tab"
            isActive={showAddColorMenu}
          />

          {/* 4 Color Circles Vertical Palette Popout positioned directly above the Plus icon */}
          {showAddColorMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 12px)',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 9px',
                borderRadius: '9999px',
                background:
                  'linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(250, 244, 246, 0.88) 50%, rgba(242, 234, 238, 0.82) 100%)',
                border: '1px solid rgba(225, 205, 215, 0.5)',
                outline: 'none',
                backdropFilter: 'blur(24px) saturate(160%)',
                WebkitBackdropFilter: 'blur(24px) saturate(160%)',
                boxShadow:
                  '0 8px 24px -4px rgba(244, 114, 182, 0.08), ' +
                  '0 2px 6px -1px rgba(0, 0, 0, 0.04), ' +
                  'inset 0 1px 1.5px 0 rgba(255, 255, 255, 1), ' +
                  'inset 0 -1px 1px 0 rgba(244, 114, 182, 0.14)',
                zIndex: 10001,
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                userSelect: 'none',
              }}
            >
              {CARD_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleCreateCardWithColor(c.hex)}
                  title={`Create ${c.name} tab`}
                  aria-label={`Create ${c.name} tab`}
                  style={{
                    width: '28px',
                    height: '28px',
                    minWidth: '28px',
                    minHeight: '28px',
                    borderRadius: '9999px', // CIRCLE
                    backgroundColor: c.hex,
                    border: '2px solid #ffffff',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.6)',
                    cursor: 'pointer',
                    padding: 0,
                    outline: 'none',
                    transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                  className="hover:scale-120 active:scale-95"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. Clear Container for the Collection Heading: top: 40px, left: 106px */}
      {showCollection && (
        <div
          style={{
            position: 'fixed',
            top: '40px',
            left: '106px',
            zIndex: 9999,
            pointerEvents: 'auto',
            // Frosted glass pill with pinkish grey gradient undertone
            minHeight: '50px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            padding: '0 28px',
            borderRadius: '9999px',
            background:
              'linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(250, 244, 246, 0.88) 50%, rgba(242, 234, 238, 0.82) 100%)',
            border: '1px solid rgba(225, 205, 215, 0.5)',
            outline: 'none',
            backdropFilter: 'blur(24px) saturate(160%)',
            WebkitBackdropFilter: 'blur(24px) saturate(160%)',
            boxShadow:
              '0 8px 24px -4px rgba(244, 114, 182, 0.08), ' +
              '0 2px 6px -1px rgba(0, 0, 0, 0.04), ' +
              'inset 0 1px 1.5px 0 rgba(255, 255, 255, 1), ' +
              'inset 0 -1px 1px 0 rgba(244, 114, 182, 0.14)',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            userSelect: 'none',
          }}
        >
          <h1
            style={{
              position: 'relative',
              zIndex: 1,
              margin: 0,
              fontSize: '20px',
              fontWeight: 600,
              color: '#272224', // Deep rose-charcoal color matching pinkish grey theme
              letterSpacing: '-0.02em',
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            Collection
          </h1>
          {collectionCards.length > 1 && (
            <span
              style={{
                position: 'relative',
                zIndex: 1,
                fontSize: '12px',
                fontWeight: 600,
                color: '#272224',
                background:
                  'linear-gradient(180deg, rgba(245, 237, 241, 0.96) 0%, rgba(232, 221, 227, 0.92) 100%)',
                border: '1px solid rgba(216, 195, 205, 0.65)',
                padding: '2px 8px',
                borderRadius: '9999px',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              }}
            >
              {collectionCards.length}
            </span>
          )}
        </div>
      )}


      {/* 3. Big Collection Cards directly on the screen with even left and right gaps */}
      {showCollection && (
        <div
          className="no-scrollbar"
          style={{
            position: 'fixed',
            top: '116px',
            left: '106px',
            right: '106px',
            maxHeight: 'calc(100vh - 146px)',
            zIndex: 9999,
            pointerEvents: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: '24px',
            alignContent: 'start',
            padding: '24px 28px',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            userSelect: 'none',
          }}
        >
          {collectionCards.map((card) => {
            const isHighlighted = hoveredCardId === card.id;
            const isColorPickerOpen = colorPickerCardId === card.id;

            return (
              <div
                key={card.id}
                onMouseEnter={() => setHoveredCardId(card.id)}
                onMouseLeave={() => setHoveredCardId(null)}
                style={{
                  width: '100%',
                  aspectRatio: '1 / 1',
                  borderRadius: '22px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxSizing: 'border-box',
                  backgroundColor: 'rgba(255, 255, 255, 0.98)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  transform: isHighlighted ? 'scale(1.025)' : 'scale(1)',
                  zIndex: isColorPickerOpen ? 30 : isHighlighted ? 20 : 1,
                  border: isHighlighted
                    ? '2px solid rgba(255, 255, 255, 0.95)'
                    : '1.5px solid rgba(226, 232, 240, 0.95)',
                  boxShadow: isHighlighted
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
                    : '0 16px 36px -4px rgba(15, 23, 42, 0.08), 0 6px 14px -2px rgba(15, 23, 42, 0.04)',
                  transition: 'all 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                className="group"
                title={`${card.title} • ${card.date}`}
              >
                {/* 1. Solid Color Banner - clicking this opens the workspace board */}
                <div
                  onClick={() => setActiveBoardCard(card)}
                  style={{
                    width: '100%',
                    flex: 1,
                    position: 'relative',
                    overflow: 'hidden',
                    backgroundColor: card.color,
                    background: `linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0) 65%), ${card.color}`,
                    transition: 'background 0.3s ease',
                    cursor: 'pointer',
                  }}
                  title={`Open ${card.title}`}
                >
                  {/* Subtle inner bottom shadow separating color and info */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(180deg, transparent 75%, rgba(0, 0, 0, 0.06) 100%)',
                    }}
                  />

                  {/* Top-left Quick Color Palette Button */}
                  <button
                    type="button"
                    className="color-edit-trigger hover:scale-110 active:scale-95"
                    onClick={(e) => {
                      e.stopPropagation();
                      setColorPickerCardId((prev) => (prev === card.id ? null : card.id));
                    }}
                    title="Change card color"
                    aria-label="Change card color"
                    style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      width: '30px',
                      height: '30px',
                      borderRadius: '9999px',
                      background: isColorPickerOpen
                        ? '#272224'
                        : 'rgba(255, 255, 255, 0.82)',
                      backdropFilter: 'blur(16px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                      border: isColorPickerOpen
                        ? '1.5px solid #272224'
                        : '1.5px solid rgba(255, 255, 255, 0.95)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.9)',
                      zIndex: 15,
                      cursor: 'pointer',
                      padding: 0,
                      outline: 'none',
                      opacity: isColorPickerOpen || isHighlighted ? 1 : 0.72,
                      transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    <svg
                      style={{
                        width: '15px',
                        height: '15px',
                        color: isColorPickerOpen ? '#ffffff' : '#272224',
                      }}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
                      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
                    </svg>
                  </button>

                  {/* Top-right Delete Tab Button directly on the tab */}
                  <button
                    type="button"
                    className="hover:scale-110 active:scale-95 group/del"
                    onClick={(e) => handleDeleteSingleCard(card.id, e)}
                    title={`Delete "${card.title}"`}
                    aria-label={`Delete ${card.title}`}
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      width: '30px',
                      height: '30px',
                      borderRadius: '9999px',
                      background: 'rgba(255, 255, 255, 0.82)',
                      backdropFilter: 'blur(16px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                      border: '1.5px solid rgba(255, 255, 255, 0.95)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.9)',
                      zIndex: 15,
                      cursor: 'pointer',
                      padding: 0,
                      outline: 'none',
                      opacity: isHighlighted ? 1 : 0.72,
                      transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    <svg
                      style={{
                        width: '14px',
                        height: '14px',
                        color: '#272224',
                        transition: 'color 0.15s ease',
                      }}
                      className="group-hover/del:text-red-600"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      <line x1="10" x2="10" y1="11" y2="17" />
                      <line x1="14" x2="14" y1="11" y2="17" />
                    </svg>
                  </button>

                  {/* Vibrant Color Selection Popover Overlay */}
                  {isColorPickerOpen && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setColorPickerCardId(null);
                      }}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        backgroundColor: 'rgba(0, 0, 0, 0.32)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        zIndex: 25,
                      }}
                    >
                      <div
                        className="color-picker-popover"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          maxWidth: '190px',
                          padding: '12px 14px',
                          borderRadius: '16px',
                          background: 'rgba(255, 255, 255, 0.96)',
                          backdropFilter: 'blur(20px)',
                          WebkitBackdropFilter: 'blur(20px)',
                          boxShadow:
                            '0 12px 28px -4px rgba(0, 0, 0, 0.28), 0 4px 10px rgba(0, 0, 0, 0.12), inset 0 1px 1.5px rgba(255, 255, 255, 1)',
                          border: '1px solid rgba(255, 255, 255, 0.9)',
                        }}
                      >
                        {CARD_COLORS.map((c) => {
                          const isCurrent = card.color.toLowerCase() === c.hex.toLowerCase();
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateCardColor(card.id, c.hex);
                                setColorPickerCardId(null);
                              }}
                              title={c.name}
                              aria-label={`Choose ${c.name}`}
                              style={{
                                width: '34px',
                                height: '34px',
                                minWidth: '34px',
                                minHeight: '34px',
                                borderRadius: '10px',
                                backgroundColor: c.hex,
                                border: isCurrent
                                  ? '2.5px solid #ffffff'
                                  : '1.5px solid rgba(255, 255, 255, 0.9)',
                                boxShadow: isCurrent
                                  ? `0 0 0 2.5px ${c.hex}, 0 4px 10px rgba(0, 0, 0, 0.3)`
                                  : '0 2px 5px rgba(0, 0, 0, 0.14)',
                                cursor: 'pointer',
                                padding: 0,
                                outline: 'none',
                                transform: isCurrent ? 'scale(1.12)' : 'scale(1)',
                                transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              className="hover:scale-120 active:scale-95"
                            >
                              {isCurrent && (
                                <svg
                                  style={{
                                    width: '16px',
                                    height: '16px',
                                    color: '#ffffff',
                                    filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4))',
                                  }}
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#ffffff',
                            letterSpacing: '0.02em',
                            textShadow: '0 1px 3px rgba(0, 0, 0, 0.7)',
                          }}
                        >
                          Choose Color
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setColorPickerCardId(null);
                          }}
                          style={{
                            padding: '2px 8px',
                            fontSize: '10px',
                            fontWeight: 600,
                            color: '#ffffff',
                            background: 'rgba(255, 255, 255, 0.25)',
                            border: '1px solid rgba(255, 255, 255, 0.5)',
                            borderRadius: '9999px',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Bottom Info Section (Title & Date) */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    padding: '8px 14px',
                    minHeight: '56px',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    backgroundColor: '#ffffff',
                    borderTop: '1px solid rgba(226, 232, 240, 0.6)',
                    cursor: 'default',
                  }}
                >
                  {editingCardId === card.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={editingTitle}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => finishEditing(card.id)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          finishEditing(card.id);
                        } else if (e.key === 'Escape') {
                          setEditingCardId(null);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#0f172a',
                        letterSpacing: '-0.015em',
                        lineHeight: '1.2',
                        padding: '2px 6px',
                        margin: '-2px -6px',
                        borderRadius: '6px',
                        border: '1.5px solid #ec4899',
                        outline: 'none',
                        background: '#ffffff',
                        boxShadow: '0 0 0 2px rgba(236, 72, 153, 0.2)',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                        maxWidth: '100%',
                      }}
                    >
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(card.id, card.title);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          startEditing(card.id, card.title);
                        }}
                        onTouchEnd={(e) => {
                          e.stopPropagation();
                          const now = Date.now();
                          const last = lastTapTimeRef.current[card.id] || 0;
                          if (now - last < 500 && now - last > 30) {
                            startEditing(card.id, card.title);
                          }
                          lastTapTimeRef.current[card.id] = now;
                        }}
                        title="Click or double-tap to edit name"
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: '#0f172a',
                          letterSpacing: '-0.015em',
                          lineHeight: '1.2',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          cursor: 'pointer',
                          transition: 'color 0.2s ease',
                          flex: 1,
                        }}
                        className="hover:text-pink-600"
                      >
                        {card.title}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(card.id, card.title);
                        }}
                        onTouchEnd={(e) => {
                          e.stopPropagation();
                          startEditing(card.id, card.title);
                        }}
                        title="Rename tab"
                        aria-label="Rename tab"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '3px',
                          margin: '-3px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#a1a1aa',
                          borderRadius: '4px',
                          outline: 'none',
                          transition: 'all 0.15s ease',
                          flexShrink: 0,
                        }}
                        className="hover:text-pink-600 active:scale-90"
                      >
                        <svg
                          style={{ width: '13px', height: '13px' }}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                    </div>
                  )}
                  <span
                    style={{
                      fontSize: '9.5px',
                      fontWeight: 500,
                      color: '#a1a1aa',
                      alignSelf: 'flex-end',
                      lineHeight: '1',
                      marginTop: '4px',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {card.date}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Database Connection Status: Left side down corner */}
      <DatabaseStatusBadge />
    </>
  );
}

export default function App() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
      }}
    >
      {/* Solid white background with the signature pink line grid pattern */}
      <PinkLineBackground />

      {/* Floating Action Buttons & Collection Panel */}
      <FloatingActionButtons />
    </div>
  );
}
