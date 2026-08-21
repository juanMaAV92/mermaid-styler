export const renderStates = ['empty', 'rendering', 'ready', 'error', 'timeout'] as const;

export type RenderState = (typeof renderStates)[number];

export const isRenderState = (value: unknown): value is RenderState =>
  renderStates.includes(value as RenderState);
