import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../../src/lib/theme/contrast';
import { DEFAULT_PRESET_ID, defaultPreset, getPreset, presetIds, presets, toThemeVariables } from '../../src/lib/theme/presets';

describe('Mermaid Styler presets', () => {
  it('exposes the five product presets', () => {
    expect(presetIds).toEqual(['light', 'dark', 'terminal', 'paper', 'architecture']);
  });

  it('defines complete hex-based theme values for every preset', () => {
    const hexColor = /^#[0-9a-f]{6}$/i;

    Object.values(presets).forEach((preset) => {
      expect(Object.keys(preset)).toEqual(['primary', 'border', 'text', 'line', 'accent', 'surface']);
      Object.values(preset).forEach((value) => expect(value).toMatch(hexColor));
    });
  });

  it('returns undefined for an unknown preset', () => {
    expect(getPreset('unknown')).toBeUndefined();
  });

  it('uses the Light preset as the product default and maps it to CSS variables', () => {
    expect(defaultPreset).toBe(presets[DEFAULT_PRESET_ID]);
    expect(toThemeVariables(defaultPreset)).toMatchObject({
      '--diagram-primary': defaultPreset.primary,
      '--diagram-surface': defaultPreset.surface,
    });
  });

  it('D7: every preset meets contrast floors', () => {
    presetIds.forEach((id) => {
      const p = presets[id];
      expect(contrastRatio(p.text, p.primary), `${id} text/primary`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.line, p.surface), `${id} line/surface`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.accent, p.surface), `${id} accent/surface`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(p.border, p.primary), `${id} border/primary`).toBeGreaterThanOrEqual(3);
    });
  });

  it('D7: light and architecture are visibly distinct', () => {
    const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const delta = (a: string, b: string) => Math.max(...hex(a).map((v, i) => Math.abs(v - hex(b)[i])));
    const { light, architecture } = presets;
    expect(Math.max(delta(light.primary, architecture.primary), delta(light.surface, architecture.surface))).toBeGreaterThanOrEqual(0x10);
  });
});
