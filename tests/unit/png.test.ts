import { describe, expect, it } from 'vitest';
import { getBoundedPngScale, getPngPixelBudget } from '../../src/lib/export/png';

describe('PNG export memory budget', () => {
  it.each([
    [2, 4_000_000],
    [4, 8_000_000],
    [8, 16_000_000],
  ])('uses a %i MP budget on a %i GB device', (deviceMemory, expectedBudget) => {
    expect(getPngPixelBudget(deviceMemory)).toBe(expectedBudget);
  });

  it('uses the conservative default when device memory is unavailable', () => {
    expect(getPngPixelBudget(undefined)).toBe(8_000_000);
  });

  it('keeps the requested density until the canvas area reaches its pixel budget', () => {
    expect(getBoundedPngScale(1_000, 1_000, 3, 16_000_000)).toBe(3);
    expect(getBoundedPngScale(4_000, 2_000, 3, 8_000_000)).toBe(1);
  });
});
