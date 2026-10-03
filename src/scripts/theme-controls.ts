import type { PngExportOptions } from '../lib/export/png';
import type { MermaidThemeOptions } from '../lib/mermaid/types';
import { DEFAULT_DIAGRAM_FONT_FAMILY, DEFAULT_DIAGRAM_FONT_SIZE } from '../lib/theme/defaults';
import { DEFAULT_PRESET_ID, defaultPreset, getPreset, toThemeVariables } from '../lib/theme/presets';

type ThemeControlsOptions = {
  workbench: HTMLElement;
  stage?: HTMLElement | null;
  currentPreset?: HTMLElement | null;
  presetList?: HTMLElement | null;
  presetButtons: HTMLButtonElement[];
  textSizeInput?: HTMLInputElement | null;
  textSizeOutput?: HTMLOutputElement | null;
  fontSelect?: HTMLSelectElement | null;
  transparentToggle?: HTMLInputElement | null;
  resetButton?: HTMLButtonElement | null;
  customPresetLabel: string;
  onChange: () => void;
};

export const initThemeControls = ({
  workbench,
  stage,
  currentPreset,
  presetList,
  presetButtons,
  textSizeInput,
  textSizeOutput,
  fontSelect,
  transparentToggle,
  resetButton,
  customPresetLabel,
  onChange,
}: ThemeControlsOptions) => {
  const colorInputs = [...workbench.querySelectorAll<HTMLInputElement>('[data-color-variable]')];

  const syncPresetTabStops = (selectedId?: string) => {
    const activeId = selectedId
      ?? presetButtons.find((button) => button.getAttribute('aria-selected') === 'true')?.dataset.preset
      ?? presetButtons[0]?.dataset.preset;
    presetButtons.forEach((button) => {
      button.tabIndex = button.dataset.preset === activeId ? 0 : -1;
    });
  };

  const applyPreset = (presetId: string) => {
    const preset = getPreset(presetId);
    if (!preset) return;

    workbench.dataset.preset = presetId;
    currentPreset?.replaceChildren(document.createTextNode(presetId[0].toUpperCase() + presetId.slice(1)));
    const variables = toThemeVariables(preset);

    Object.entries(variables).forEach(([name, value]) => workbench.style.setProperty(name, value));
    presetButtons.forEach((button) => {
      const selected = button.dataset.preset === presetId;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-selected', String(selected));
    });
    syncPresetTabStops(presetId);

    colorInputs.forEach((input) => {
      const colorVariable = input.dataset.colorVariable as keyof typeof variables | undefined;
      const value = colorVariable ? variables[colorVariable] : undefined;
      if (!value) return;
      input.value = value;
      const output = workbench.querySelector<HTMLElement>(`[data-color-value="${input.id}"]`);
      if (output) output.textContent = value;
    });
  };

  const markCustom = () => {
    workbench.dataset.preset = 'custom';
    if (currentPreset) currentPreset.textContent = customPresetLabel;
    presetButtons.forEach((button) => {
      button.classList.remove('is-selected');
      button.setAttribute('aria-selected', 'false');
    });
    syncPresetTabStops();
  };

  const getMermaidThemeOptions = (): MermaidThemeOptions => {
    const computed = getComputedStyle(workbench);
    const read = (name: string, fallback: string) => computed.getPropertyValue(name).trim() || fallback;
    const fontSize = Number.parseInt(read('--diagram-font-size', `${DEFAULT_DIAGRAM_FONT_SIZE}px`), 10);

    return {
      background: read('--diagram-surface', defaultPreset.surface),
      primaryColor: read('--diagram-primary', defaultPreset.primary),
      primaryBorderColor: read('--diagram-border', defaultPreset.border),
      primaryTextColor: read('--diagram-text', defaultPreset.text),
      lineColor: read('--diagram-line', defaultPreset.line),
      accentColor: read('--diagram-accent', defaultPreset.accent),
      fontFamily: read('--diagram-font', DEFAULT_DIAGRAM_FONT_FAMILY),
      fontSize: Number.isFinite(fontSize) ? fontSize : DEFAULT_DIAGRAM_FONT_SIZE,
      transparent: stage?.classList.contains('is-transparent') ?? false,
    };
  };

  const getPngOptions = (): PngExportOptions => {
    const theme = getMermaidThemeOptions();
    return {
      fontFamily: theme.fontFamily,
      fontSize: `${theme.fontSize}px`,
      textColor: theme.primaryTextColor,
      background: theme.background,
      transparent: theme.transparent,
    };
  };

  presetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      applyPreset(button.dataset.preset ?? DEFAULT_PRESET_ID);
      onChange();
    });
  });

  presetList?.addEventListener('keydown', (event) => {
    if (!(event instanceof KeyboardEvent)) return;
    const currentIndex = presetButtons.indexOf(document.activeElement as HTMLButtonElement);
    if (currentIndex < 0) return;

    const nextIndex = {
      ArrowDown: Math.min(currentIndex + 1, presetButtons.length - 1),
      ArrowRight: Math.min(currentIndex + 1, presetButtons.length - 1),
      ArrowUp: Math.max(currentIndex - 1, 0),
      ArrowLeft: Math.max(currentIndex - 1, 0),
      Home: 0,
      End: presetButtons.length - 1,
    }[event.key as 'ArrowDown' | 'ArrowRight' | 'ArrowUp' | 'ArrowLeft' | 'Home' | 'End'];

    if (nextIndex === undefined) return;
    event.preventDefault();
    presetButtons[nextIndex].focus();
    presetButtons[nextIndex].click();
  });

  colorInputs.forEach((input) => {
    input.addEventListener('input', () => {
      const variable = input.dataset.colorVariable;
      if (!variable) return;
      workbench.style.setProperty(variable, input.value);
      const output = workbench.querySelector<HTMLElement>(`[data-color-value="${input.id}"]`);
      if (output) output.textContent = input.value;
      markCustom();
      onChange();
    });
  });

  fontSelect?.addEventListener('change', () => {
    workbench.style.setProperty('--diagram-font', fontSelect.value);
    markCustom();
    onChange();
  });

  textSizeInput?.addEventListener('input', () => {
    const value = `${textSizeInput.value}px`;
    workbench.style.setProperty('--diagram-font-size', value);
    if (textSizeOutput) textSizeOutput.value = value;
    markCustom();
    onChange();
  });

  transparentToggle?.addEventListener('change', () => {
    stage?.classList.toggle('is-transparent', transparentToggle.checked);
    markCustom();
    onChange();
  });

  resetButton?.addEventListener('click', () => {
    applyPreset(DEFAULT_PRESET_ID);
    if (fontSelect) fontSelect.selectedIndex = 0;
    if (textSizeInput) textSizeInput.value = String(DEFAULT_DIAGRAM_FONT_SIZE);
    if (textSizeOutput) textSizeOutput.value = `${DEFAULT_DIAGRAM_FONT_SIZE}px`;
    workbench.style.setProperty('--diagram-font', DEFAULT_DIAGRAM_FONT_FAMILY);
    workbench.style.setProperty('--diagram-font-size', `${DEFAULT_DIAGRAM_FONT_SIZE}px`);
    if (transparentToggle) transparentToggle.checked = false;
    stage?.classList.remove('is-transparent');
    onChange();
  });

  syncPresetTabStops();

  return { getMermaidThemeOptions, getPngOptions };
};
