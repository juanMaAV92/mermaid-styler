import { describe, expect, it } from 'vitest';
import { isRenderState, renderStates } from '../../src/lib/ui/render-state';

describe('render state boundary', () => {
  it('keeps the UI state vocabulary explicit', () => {
    expect(renderStates).toEqual(['empty', 'rendering', 'ready', 'error', 'timeout']);
  });

  it('accepts only known render states', () => {
    renderStates.forEach((state) => expect(isRenderState(state)).toBe(true));
    expect(isRenderState('custom')).toBe(false);
    expect(isRenderState(null)).toBe(false);
  });
});

describe('render timing constants', () => {
  it('pins the debounce, error reveal and overlay delays', async () => {
    const mod = await import('../../src/lib/ui/render-state');
    expect(mod.RENDER_DEBOUNCE_MS).toBe(300);
    expect(mod.ERROR_REVEAL_MS).toBe(800);
    expect(mod.RENDERING_OVERLAY_DELAY_MS).toBe(400);
  });
});
