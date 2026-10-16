import { describe, expect, it } from 'vitest';
import {
  clampScale,
  computeFitScale,
  computePanLimit,
  wheelZoomFactor,
  zoomAt,
} from '../../src/lib/ui/preview-geometry';

const viewport = { width: 800, height: 600 };

describe('computeFitScale', () => {
  it('caps small content at MAX_SCALE', () => {
    expect(computeFitScale({ width: 100, height: 50 }, viewport)).toBe(2);
  });
  it('shrinks large content with padding', () => {
    expect(computeFitScale({ width: 4000, height: 3000 }, viewport)).toBeCloseTo(0.18, 5);
  });
  it('floors extreme content at MIN_SCALE', () => {
    expect(computeFitScale({ width: 100000, height: 10 }, viewport)).toBe(0.1);
  });
  it('returns 1 for invalid content sizes', () => {
    expect(computeFitScale({ width: 0, height: 10 }, viewport)).toBe(1);
    expect(computeFitScale({ width: 10, height: -5 }, viewport)).toBe(1);
    expect(computeFitScale({ width: NaN, height: 10 }, viewport)).toBe(1);
    expect(computeFitScale({ width: Infinity, height: 10 }, viewport)).toBe(1);
  });
});

describe('computePanLimit', () => {
  it('is the margin when content is smaller than the viewport', () => {
    expect(computePanLimit({ width: 100, height: 100 }, viewport, 1)).toEqual({ x: 48, y: 48 });
  });
  it('grows with scaled overflow', () => {
    expect(computePanLimit({ width: 1000, height: 100 }, viewport, 2)).toEqual({
      x: (2000 - 800) / 2 + 48,
      y: 48,
    });
  });
});

describe('wheelZoomFactor', () => {
  it('zooms out on positive delta and in on negative', () => {
    expect(wheelZoomFactor(100)).toBeLessThan(1);
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1);
    expect(wheelZoomFactor(0)).toBe(1);
  });
});

describe('clampScale', () => {
  it('clamps to the range', () => {
    expect(clampScale(0.01)).toBe(0.1);
    expect(clampScale(5)).toBe(2);
    expect(clampScale(1)).toBe(1);
  });
});

describe('zoomAt', () => {
  it('keeps the content point under the cursor fixed', () => {
    const point = { x: 120, y: -80 };
    const pan = { x: 30, y: 15 };
    const scale = 0.8;
    const next = 1.6;
    const p = zoomAt(point, scale, next, pan);
    expect((point.x - pan.x) / scale).toBeCloseTo((point.x - p.x) / next, 9);
    expect((point.y - pan.y) / scale).toBeCloseTo((point.y - p.y) / next, 9);
  });
  it('is identity when scale is unchanged', () => {
    expect(zoomAt({ x: 5, y: 6 }, 1, 1, { x: 2, y: 3 })).toEqual({ x: 2, y: 3 });
  });
});
