export const renderStates = ['empty', 'rendering', 'ready', 'error', 'timeout'] as const;

export type RenderState = (typeof renderStates)[number];

export const isRenderState = (value: unknown): value is RenderState =>
  renderStates.includes(value as RenderState);

/** Idle time after the last change before a render starts. */
export const RENDER_DEBOUNCE_MS = 300;
/** Idle time after the last source input before a render error is revealed. */
export const ERROR_REVEAL_MS = 800;
/** Time a render may run before the existing artifact is dimmed with an overlay. */
export const RENDERING_OVERLAY_DELAY_MS = 400;
