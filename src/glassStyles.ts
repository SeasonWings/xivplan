import { shorthands, tokens } from '@fluentui/react-components';

export const glassSurface = {
    backgroundColor: `rgb(var(--glass-bg-rgb, 255 255 255) / var(--glass-alpha, 0.58))`,
    ...shorthands.borderRadius('var(--glass-radius, 12px)'),
    boxShadow: `var(--glass-shadow, 0 8px 16px rgba(0,0,0,0.12)), inset 0 0 0 1px var(--glass-border, rgba(255,255,255,0.2))`,
    backdropFilter: `blur(var(--glass-blur, 10px))`,
    WebkitBackdropFilter: `blur(var(--glass-blur, 10px))`,
    transitionProperty: 'background-color, box-shadow, transform, backdrop-filter',
    transitionDuration: '200ms',
    transitionTimingFunction: tokens.curveEasyEase,
};

export const glassSurfaceStrong = {
    backgroundColor: `rgb(var(--glass-bg-rgb, 255 255 255) / min(0.25, calc(var(--glass-alpha, 0.58) + 0.06)))`,
    ...shorthands.borderRadius('var(--glass-radius, 12px)'),
    boxShadow: `var(--glass-shadow, 0 8px 16px rgba(0,0,0,0.12)), inset 0 0 0 1px var(--glass-border, rgba(255,255,255,0.2))`,
    backdropFilter: `blur(var(--glass-blur, 12px))`,
    WebkitBackdropFilter: `blur(var(--glass-blur, 12px))`,
    transitionProperty: 'background-color, box-shadow, transform, backdrop-filter',
    transitionDuration: '200ms',
    transitionTimingFunction: tokens.curveEasyEase,
};

export const glassToolbar = {
    ...glassSurface,
    ...shorthands.padding('8px'),
    gap: '8px',
};
