/**
 * Design System Specifications for Buttons
 * Saved under: buttons -> state: default, hover & active
 */
export const buttonDesignSystem = {
  buttons: {
    default: {
      name: 'Frosted Pink Liquid Glass Circle Button (Default State)',
      state: 'default',
      dimensions: {
        width: 50, // 50px
        height: 50, // 50px
        borderRadius: '9999px', // full circle
        iconRatio: 0.6, // 60% of button diameter
        iconSize: 30, // 30px
      },
      containerStyle: {
        background:
          'linear-gradient(140deg, rgba(236, 72, 153, 0.52) 0%, rgba(219, 39, 119, 0.56) 100%)',
        backdropFilter: 'blur(24px) saturate(180%) contrast(105%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%) contrast(105%)',
        border: '1px solid rgba(255, 255, 255, 0.55)',
        boxShadow:
          '0 14px 30px -6px rgba(0, 0, 0, 0.12), ' +
          '0 4px 12px -2px rgba(0, 0, 0, 0.06), ' +
          'inset 1px 1px 1px 0 rgba(255, 255, 255, 0.95), ' + // thin 45° top-left boundary specular arc shine
          'inset -1px -1px 1px 0 rgba(255, 255, 255, 0.80), ' + // thin 45° bottom-right opposite boundary arc shine
          'inset 0 0 4px 0 rgba(255, 255, 255, 0.15)', // subtle internal frosted glow
        transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      internalDiffusionStyle: {
        background:
          'radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.28) 0%, rgba(219, 39, 119, 0.2) 55%, transparent 80%)',
        filter: 'blur(6px)',
      },
      iconStyle: {
        color: '#ffffff',
        strokeWidth: 2.5,
        dimension: 30,
      },
      folderIconStyle: {
        color: '#ffffff',
        strokeWidth: 2.5,
        dimension: 30, // exact same 30px size as plus icon
        opticalTransform: 'translateX(-0.5px) translateY(0.25px)',
      },
    },
    hover: {
      name: 'Frosted Pink Liquid Glass Circle Button (Hover State)',
      state: 'hover',
      // One shade lighter for both colors in the gradient
      gradient: {
        from: 'rgba(244, 114, 182, 0.54)', // pink-400 (1 shade lighter than pink-500)
        to: 'rgba(236, 72, 153, 0.58)',   // pink-500 (1 shade lighter than pink-600)
      },
      containerStyle: {
        background:
          'linear-gradient(140deg, rgba(244, 114, 182, 0.54) 0%, rgba(236, 72, 153, 0.58) 100%)',
        boxShadow:
          '0 18px 36px -6px rgba(236, 72, 153, 0.25), ' +
          '0 6px 16px -2px rgba(0, 0, 0, 0.08), ' +
          'inset 1.2px 1.2px 1.2px 0 rgba(255, 255, 255, 1), ' + // thin 45° top-left shine on hover
          'inset -1.2px -1.2px 1.2px 0 rgba(255, 255, 255, 0.9), ' + // thin opposite 45° shine
          'inset 0 0 6px 0 rgba(255, 255, 255, 0.2)',
      },
    },
    active: {
      name: 'Frosted Pink Liquid Glass Circle Button (Active State)',
      state: 'active',
      dimensions: {
        width: 50,
        height: 50,
        borderRadius: '9999px',
        iconRatio: 0.6,
        iconSize: 30,
      },
      gradient: {
        from: 'rgba(244, 114, 182, 0.62)', // pink-400 (enhanced vibrance on active)
        to: 'rgba(236, 72, 153, 0.66)',   // pink-500
      },
      containerStyle: {
        background:
          'linear-gradient(140deg, rgba(244, 114, 182, 0.62) 0%, rgba(236, 72, 153, 0.66) 100%)',
        backdropFilter: 'blur(24px) saturate(180%) contrast(105%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%) contrast(105%)',
        border: '1px solid rgba(255, 255, 255, 0.75)',
        boxShadow:
          '0 6px 18px -4px rgba(0, 0, 0, 0.16), ' +
          '0 2px 6px -2px rgba(0, 0, 0, 0.08), ' +
          'inset 1px 1px 1px 0 rgba(255, 255, 255, 0.95), ' + // thin 45° top-left boundary arc
          'inset -1px -1px 1px 0 rgba(255, 255, 255, 0.85), ' + // thin 45° bottom-right opposite arc
          'inset 0 0 8px rgba(255, 255, 255, 0.2)',
        transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      internalDiffusionStyle: {
        background:
          'radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.38) 0%, rgba(236, 72, 153, 0.28) 55%, transparent 80%)',
        filter: 'blur(6px)',
      },
      iconStyle: {
        color: '#ffffff',
        strokeWidth: 2.5,
        dimension: 30,
      },
    },
  },
} as const;

export type ButtonDesignTokens = typeof buttonDesignSystem;
