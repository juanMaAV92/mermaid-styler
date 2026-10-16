import { describe, expect, it } from 'vitest';
import {
  MANUAL_MAX_SCALE,
  MAX_SCALE,
  clampScale,
  computeFitScale,
  computePanLimit,
  hasSignificantSizeChange,
  parseSvgIntrinsicSize,
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
  it('accepts a custom max for manual zoom', () => {
    expect(MANUAL_MAX_SCALE).toBeGreaterThan(MAX_SCALE);
    expect(clampScale(3, MANUAL_MAX_SCALE)).toBe(3);
    expect(clampScale(9, MANUAL_MAX_SCALE)).toBe(MANUAL_MAX_SCALE);
  });
  it('returns the fallback (default 1) for NaN', () => {
    expect(clampScale(Number.NaN)).toBe(1);
    expect(clampScale(Number.NaN, MAX_SCALE, 0.5)).toBe(0.5);
  });
  it('clamps infinities to the range', () => {
    expect(clampScale(Number.POSITIVE_INFINITY)).toBe(MAX_SCALE);
    expect(clampScale(Number.NEGATIVE_INFINITY)).toBe(0.1);
  });
});

describe('parseSvgIntrinsicSize', () => {
  it('prefers the viewBox size', () => {
    expect(parseSvgIntrinsicSize({ viewBox: '-8 -8 640.5 120', width: '10', height: '10' })).toEqual({ width: 640.5, height: 120 });
  });
  it('falls back to numeric width/height attributes', () => {
    expect(parseSvgIntrinsicSize({ viewBox: null, width: '300px', height: '150' })).toEqual({ width: 300, height: 150 });
  });
  it('ignores percentages and invalid values', () => {
    expect(parseSvgIntrinsicSize({ viewBox: '0 0 0 0', width: '100%', height: '20' })).toBeUndefined();
    expect(parseSvgIntrinsicSize({ viewBox: 'nope', width: null, height: null })).toBeUndefined();
  });
});

describe('hasSignificantSizeChange', () => {
  const base = { width: 1000, height: 500 };
  it('is true without a previous size', () => {
    expect(hasSignificantSizeChange(undefined, base)).toBe(true);
  });
  it('is false within 20% on both axes', () => {
    expect(hasSignificantSizeChange(base, { width: 1190, height: 420 })).toBe(false);
  });
  it('is true when either axis changes by more than 20%', () => {
    expect(hasSignificantSizeChange(base, { width: 1210, height: 500 })).toBe(true);
    expect(hasSignificantSizeChange(base, { width: 1000, height: 390 })).toBe(true);
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
  it('returns the pan unchanged for non-positive or non-finite scales', () => {
    const pan = { x: 2, y: 3 };
    expect(zoomAt({ x: 5, y: 6 }, 0, 1, pan)).toEqual(pan);
    expect(zoomAt({ x: 5, y: 6 }, -1, 1, pan)).toEqual(pan);
    expect(zoomAt({ x: 5, y: 6 }, 1, Number.NaN, pan)).toEqual(pan);
    expect(zoomAt({ x: 5, y: 6 }, Number.POSITIVE_INFINITY, 1, pan)).toEqual(pan);
    expect(zoomAt({ x: 5, y: 6 }, 1, 0, pan)).toEqual(pan);
  });
});
