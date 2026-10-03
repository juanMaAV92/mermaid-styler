import { describe, expect, it } from 'vitest';
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
});
