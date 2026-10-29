import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { buttonDesignSystem } from './tokens';

export interface LiquidGlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  isActive?: boolean;
  disableActive?: boolean;
}

/**
 * LiquidGlassButton Component
 * Implementation of the Design System button states:
 * - default: Translucent two-tone pink gradient (pink-500 & pink-600) with 24px blur
 * - hover: Gradient shifts 1 shade lighter for both tones (pink-400 & pink-500)
 * - active: Enhanced vibrant gradient with pressed depth and 0.95 scale (can be disabled via disableActive)
 */
export function LiquidGlassButton({
  onClick,
  title = 'Create new note',
  'aria-label': ariaLabel = 'Add',
  className = '',
  children,
  icon,
  isActive = false,
  disableActive = false,
  style,
  ...props
}: LiquidGlassButtonProps) {
  const config = buttonDesignSystem.buttons.default;
  const hoverConfig = buttonDesignSystem.buttons.hover;
  const activeConfig = buttonDesignSystem.buttons.active;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={`relative group w-[50px] h-[50px] min-w-[50px] min-h-[50px] rounded-full flex items-center justify-center cursor-pointer overflow-hidden transition-all duration-300 hover:scale-105 ${disableActive ? '' : 'active:scale-95'} select-none ${className}`}
      style={{
        ...(isActive && !disableActive ? activeConfig.containerStyle : config.containerStyle),
        ...style,
      }}
      {...props}
    >
      {/* Hover Gradient Overlay: One shade lighter on both colors, buttery smooth cross-fade */}
      {(!isActive || disableActive) && (
        <div
          className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: hoverConfig.containerStyle.background,
          }}
        />
      )}

      {/* Active Press Overlay when user clicks/taps (omitted when disableActive is true) */}
      {!disableActive && (
        <div
          className="absolute inset-0 rounded-full opacity-0 group-active:opacity-100 transition-opacity duration-150 pointer-events-none"
          style={{
            background: activeConfig.containerStyle.background,
          }}
        />
      )}

      {/* Soft internal frosted diffusion layer to blur and blend the gradient */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={isActive ? activeConfig.internalDiffusionStyle : config.internalDiffusionStyle}
      />

      {/* Thin 45-degree opposing boundary specular arc shines */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 15% 15%, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.25) 5%, transparent 10%), ' +
            'radial-gradient(circle at 85% 85%, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.2) 5%, transparent 10%)',
          mixBlendMode: 'screen',
        }}
      />

      {/* Render custom icon, children, or default plus icon */}
      {icon ? (
        <span className="relative z-10 flex items-center justify-center text-white">
          {icon}
        </span>
      ) : children ? (
        <div className="relative z-10">{children}</div>
      ) : (
        /* Default 60% Size (30px) Pure White Plus Icon */
        <svg
          className="relative z-10 w-[30px] h-[30px] text-white transition-transform duration-350 ease-out group-hover:rotate-90 group-hover:scale-105 drop-shadow-sm"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={config.iconStyle.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )}
    </button>
  );
}
