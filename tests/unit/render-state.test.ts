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
