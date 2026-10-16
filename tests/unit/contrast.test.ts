import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, relativeLuminance } from '../../src/lib/theme/contrast';

describe('contrast helpers', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#336699', '#336699')).toBe(1);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBe(0);
  });

  it('throws on invalid input', () => {
    expect(() => relativeLuminance('#fff')).toThrow();
    expect(() => contrastRatio('red', '#ffffff')).toThrow();
  });

  it('--ember-ink reads at 4.5:1 on the paper stage surface', () => {
    const css = readFileSync('src/styles/tokens.css', 'utf8');
    const ink = /--ember-ink:\s*(#[0-9a-f]{6})/i.exec(css)?.[1];
    const paper = /--paper:\s*(#[0-9a-f]{6})/i.exec(css)?.[1];
    expect(ink).toBeDefined();
    expect(paper).toBeDefined();
    expect(contrastRatio(ink!, paper!)).toBeGreaterThanOrEqual(4.5);
  });
});
