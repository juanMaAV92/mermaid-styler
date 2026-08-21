import messages from '../i18n/messages.en';
import { getPreset } from '../lib/theme/presets';
import { isRenderState, type RenderState } from '../lib/ui/render-state';

type RenderStateOptions = {
  message?: string;
  detail?: string;
  hasArtifact?: boolean;
};

type RenderStateEvent = RenderStateOptions & { state: RenderState };

type MermaidStylerWindow = Window & {
  mermaidStylerUI?: {
    setRenderState: (state: RenderState, options?: RenderStateOptions) => void;
  };
};

const workbench = document.querySelector<HTMLElement>('[data-workbench]');

if (workbench) {
  const sourceInput = workbench.querySelector<HTMLTextAreaElement>('[data-source-input]');
  const sourceCount = workbench.querySelector<HTMLElement>('[data-source-count]');
  const stage = workbench.querySelector<HTMLElement>('[data-artifact-stage]');
  const stageStatus = workbench.querySelector<HTMLElement>('[data-stage-status]');
  const stageCaption = workbench.querySelector<HTMLElement>('[data-stage-caption-text]');
  const stageStateViews = [...workbench.querySelectorAll<HTMLElement>('[data-state-view]')];
  const stageNotices = [...workbench.querySelectorAll<HTMLElement>('[data-state-notice]')];
  const currentPreset = workbench.querySelector<HTMLElement>('[data-current-preset]');
  const presetList = workbench.querySelector<HTMLElement>('[role="listbox"]');
  const presetButtons = [...workbench.querySelectorAll<HTMLButtonElement>('[data-preset]')];
  const textSizeInput = workbench.querySelector<HTMLInputElement>('[data-text-size-input]');
  const textSizeOutput = workbench.querySelector<HTMLOutputElement>('[data-text-size]');
  const fontSelect = workbench.querySelector<HTMLSelectElement>('[data-font-select]');
  const transparentToggle = workbench.querySelector<HTMLInputElement>('[data-transparent-toggle]');
  const resetButton = workbench.querySelector<HTMLButtonElement>('[data-reset-styles]');
  const sourceFeedback = workbench.querySelector<HTMLElement>('[data-source-feedback]');
  const sourceFeedbackTitle = workbench.querySelector<HTMLElement>('[data-source-feedback-title]');
  const sourceFeedbackBody = workbench.querySelector<HTMLElement>('[data-source-feedback-body]');
  const stateBadge = workbench.querySelector<HTMLElement>('[data-state-badge]');
  const liveStatus = workbench.querySelector<HTMLElement>('[data-live-status]');
  const actionButtons = [...workbench.querySelectorAll<HTMLButtonElement>('[data-action]')];

  const stateCopy: Record<RenderState, { label: string; caption: string }> = {
    empty: { label: messages.stateEmpty, caption: messages.emptyState },
    rendering: { label: messages.stateRendering, caption: messages.renderingState },
    ready: { label: messages.stateReady, caption: messages.readyState },
    error: { label: messages.stateInvalid, caption: messages.invalidStateHint },
    timeout: { label: messages.stateTimeout, caption: messages.timeoutStateHint },
  };

  const syncPresetTabStops = (selectedId?: string) => {
    const activeId = selectedId
      ?? presetButtons.find((button) => button.getAttribute('aria-selected') === 'true')?.dataset.preset
      ?? presetButtons[0]?.dataset.preset;
    presetButtons.forEach((button) => {
      button.tabIndex = button.dataset.preset === activeId ? 0 : -1;
    });
  };

  const applyRenderState = (state: RenderState, options: RenderStateOptions = {}) => {
    if (options.hasArtifact !== undefined) {
      workbench.dataset.hasArtifact = String(options.hasArtifact);
    }

    const hasArtifact = workbench.dataset.hasArtifact === 'true';
    const isError = state === 'error' || state === 'timeout';
    const baseState = isError ? (hasArtifact ? 'ready' : 'empty') : state;
    const copy = stateCopy[state];

    workbench.dataset.renderState = state;
    if (stage) stage.dataset.renderState = state;
    stageStateViews.forEach((view) => {
      view.hidden = view.dataset.stateView !== baseState;
    });
    stageNotices.forEach((notice) => {
      notice.hidden = notice.dataset.stateNotice !== state || !isError;
    });

    if (stageStatus) stageStatus.textContent = copy.label;
    if (stageCaption) stageCaption.textContent = options.message ?? copy.caption;
    if (stateBadge) {
      stateBadge.textContent = copy.label;
      stateBadge.classList.toggle('status-badge--active', state === 'ready');
      stateBadge.classList.toggle('status-badge--warning', isError);
    }
    if (liveStatus) {
      liveStatus.textContent = `${messages.statusAnnounce}: ${copy.label}. ${options.message ?? copy.caption}`;
    }

    if (sourceFeedback) sourceFeedback.hidden = !isError;
    if (sourceFeedbackTitle) sourceFeedbackTitle.textContent = copy.label;
    if (sourceFeedbackBody) {
      sourceFeedbackBody.textContent = options.detail ?? (state === 'timeout' ? messages.timeoutStateHint : messages.errorFallback);
    }

    actionButtons.forEach((button) => {
      button.disabled = !hasArtifact || state !== 'ready';
    });
  };

  const applyPreset = (presetId: string) => {
    const preset = getPreset(presetId);
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
    syncPresetTabStops(presetId);

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
    syncPresetTabStops();
  };

  presetButtons.forEach((button) => {
    button.addEventListener('click', () => applyPreset(button.dataset.preset ?? 'light'));
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
    if (sourceCount && sourceInput) sourceCount.textContent = `${sourceInput.value.length} ${messages.sourceCount}`;
  };

  sourceInput?.addEventListener('input', () => {
    updateSourceCount();
    if (!sourceInput.value.trim()) applyRenderState('empty', { hasArtifact: false });
  });

  const uiApi = {
    setRenderState: (state: RenderState, options: RenderStateOptions = {}) => applyRenderState(state, options),
  };

  (window as MermaidStylerWindow).mermaidStylerUI = uiApi;
  window.addEventListener('mermaid-styler:render-state', (event) => {
    const detail = (event as CustomEvent<RenderStateEvent>).detail;
    if (!detail || !isRenderState(detail.state)) return;
    applyRenderState(detail.state, detail);
  });

  syncPresetTabStops();
  updateSourceCount();
  actionButtons.forEach((button) => {
    button.disabled = true;
  });
}
