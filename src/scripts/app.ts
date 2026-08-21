type Preset = {
  primary: string;
  border: string;
  text: string;
  line: string;
  accent: string;
  surface: string;
};

const presets: Record<string, Preset> = {
  light: { primary: '#d8eceb', border: '#50727c', text: '#20303a', line: '#50727c', accent: '#69e6f7', surface: '#f4f1e8' },
  dark: { primary: '#304c63', border: '#69e6f7', text: '#f4f1e8', line: '#69e6f7', accent: '#ff6b57', surface: '#151c24' },
  terminal: { primary: '#183d2e', border: '#8ef0b4', text: '#d9ffe5', line: '#8ef0b4', accent: '#f2d479', surface: '#07120f' },
  paper: { primary: '#f1d7bb', border: '#a76b47', text: '#3f3028', line: '#a76b47', accent: '#ff6b57', surface: '#f4f1e8' },
  architecture: { primary: '#cad9df', border: '#356575', text: '#19313c', line: '#356575', accent: '#69e6f7', surface: '#e6edf0' },
};

const workbench = document.querySelector<HTMLElement>('[data-workbench]');

if (workbench) {
  const sourceInput = workbench.querySelector<HTMLTextAreaElement>('[data-source-input]');
  const sourceCount = workbench.querySelector<HTMLElement>('[data-source-count]');
  const stage = workbench.querySelector<HTMLElement>('[data-artifact-stage]');
  const currentPreset = workbench.querySelector<HTMLElement>('[data-current-preset]');
  const presetButtons = [...workbench.querySelectorAll<HTMLButtonElement>('[data-preset]')];
  const textSizeInput = workbench.querySelector<HTMLInputElement>('[data-text-size-input]');
  const textSizeOutput = workbench.querySelector<HTMLOutputElement>('[data-text-size]');
  const fontSelect = workbench.querySelector<HTMLSelectElement>('[data-font-select]');
  const transparentToggle = workbench.querySelector<HTMLInputElement>('[data-transparent-toggle]');
  const resetButton = workbench.querySelector<HTMLButtonElement>('[data-reset-styles]');

  const applyPreset = (presetId: string) => {
    const preset = presets[presetId];
    if (!preset) return;

    workbench.dataset.preset = presetId;
    currentPreset?.replaceChildren(document.createTextNode(presetId[0].toUpperCase() + presetId.slice(1)));

    const variables: Record<string, string> = {
      '--diagram-primary': preset.primary,
      '--diagram-border': preset.border,
      '--diagram-text': preset.text,
      '--diagram-line': preset.line,
      '--diagram-accent': preset.accent,
      '--diagram-surface': preset.surface,
    };

    Object.entries(variables).forEach(([name, value]) => workbench.style.setProperty(name, value));
    presetButtons.forEach((button) => {
      const selected = button.dataset.preset === presetId;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-selected', String(selected));
    });

    workbench.querySelectorAll<HTMLInputElement>('[data-color-variable]').forEach((input) => {
      const value = variables[input.dataset.colorVariable ?? ''];
      if (value) {
        input.value = value;
        const output = workbench.querySelector<HTMLElement>(`[data-color-value="${input.id}"]`);
        if (output) output.textContent = value;
      }
    });
  };

  const markCustom = () => {
    workbench.dataset.preset = 'custom';
    if (currentPreset) currentPreset.textContent = 'Custom';
    presetButtons.forEach((button) => {
      button.classList.remove('is-selected');
      button.setAttribute('aria-selected', 'false');
    });
  };

  presetButtons.forEach((button) => {
    button.addEventListener('click', () => applyPreset(button.dataset.preset ?? 'light'));
  });

  workbench.querySelectorAll<HTMLInputElement>('[data-color-variable]').forEach((input) => {
    input.addEventListener('input', () => {
      const variable = input.dataset.colorVariable;
      if (!variable) return;
      workbench.style.setProperty(variable, input.value);
      const output = workbench.querySelector<HTMLElement>(`[data-color-value="${input.id}"]`);
      if (output) output.textContent = input.value;
      markCustom();
    });
  });

  fontSelect?.addEventListener('change', () => {
    workbench.style.setProperty('--diagram-font', fontSelect.value);
    markCustom();
  });

  textSizeInput?.addEventListener('input', () => {
    const value = `${textSizeInput.value}px`;
    workbench.style.setProperty('--diagram-font-size', value);
    if (textSizeOutput) textSizeOutput.value = value;
    markCustom();
  });

  transparentToggle?.addEventListener('change', () => {
    stage?.classList.toggle('is-transparent', transparentToggle.checked);
    markCustom();
  });

  resetButton?.addEventListener('click', () => {
    applyPreset('light');
    if (fontSelect) fontSelect.selectedIndex = 0;
    if (textSizeInput) textSizeInput.value = '16';
    if (textSizeOutput) textSizeOutput.value = '16px';
    workbench.style.setProperty('--diagram-font', 'IBM Plex Sans, ui-sans-serif, sans-serif');
    workbench.style.setProperty('--diagram-font-size', '16px');
    if (transparentToggle) transparentToggle.checked = false;
    stage?.classList.remove('is-transparent');
  });

  const updateSourceCount = () => {
    if (sourceCount && sourceInput) sourceCount.textContent = `${sourceInput.value.length} chars`;
  };

  sourceInput?.addEventListener('input', updateSourceCount);
  updateSourceCount();
}
