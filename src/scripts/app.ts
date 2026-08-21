import messages from '../i18n/messages.en';
import { MermaidRenderError } from '../lib/mermaid/types';
import type { MermaidRenderResult, MermaidThemeOptions, RenderMermaidOptions } from '../lib/mermaid/types';
import { LatestWinsRenderCoordinator } from '../lib/mermaid/render-coordinator';
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
  const scaffoldPreview = workbench.querySelector<HTMLElement>('[data-scaffold-preview]');
  const svgHost = workbench.querySelector<HTMLElement>('[data-svg-host]');
  const previewViewport = workbench.querySelector<HTMLElement>('[data-preview-viewport]');
  const previewLayer = workbench.querySelector<HTMLElement>('[data-preview-layer]');
  const previewZoom = workbench.querySelector<HTMLOutputElement>('[data-preview-zoom]');
  const previewActions = [...workbench.querySelectorAll<HTMLButtonElement>('[data-preview-action]')];
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
  const renderCoordinator = new LatestWinsRenderCoordinator<RenderMermaidOptions, MermaidRenderResult>(async (source, options) => {
    const { renderMermaid } = await import('../lib/mermaid/render-mermaid');
    return renderMermaid(source, options);
  });
  let renderTimer: ReturnType<typeof setTimeout> | undefined;
  let renderRequestToken = 0;
  let requestRender = () => undefined;

  const stateCopy: Record<RenderState, { label: string; caption: string }> = {
    empty: { label: messages.stateEmpty, caption: messages.emptyState },
    rendering: { label: messages.stateRendering, caption: messages.renderingState },
    ready: { label: messages.stateReady, caption: messages.readyState },
    error: { label: messages.stateInvalid, caption: messages.invalidStateHint },
    timeout: { label: messages.stateTimeout, caption: messages.timeoutStateHint },
  };

  const PREVIEW_ZOOM_MIN = 0.5;
  const PREVIEW_ZOOM_MAX = 4;
  const PREVIEW_ZOOM_STEP = 0.25;
  const PREVIEW_PAN_LIMIT = 1200;
  let previewScale = 1;
  let previewPanX = 0;
  let previewPanY = 0;
  let activePointer: { id: number; startX: number; startY: number; panX: number; panY: number } | undefined;

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  const applyPreviewTransform = () => {
    if (!previewLayer) return;
    previewLayer.style.setProperty('--preview-scale', String(previewScale));
    previewLayer.style.setProperty('--preview-pan-x', `${previewPanX}px`);
    previewLayer.style.setProperty('--preview-pan-y', `${previewPanY}px`);
    if (previewZoom) previewZoom.value = `${Math.round(previewScale * 100)}%`;
  };

  const fitPreview = () => {
    previewScale = 1;
    previewPanX = 0;
    previewPanY = 0;
    applyPreviewTransform();
  };

  const setPreviewZoom = (nextScale: number) => {
    previewScale = clamp(nextScale, PREVIEW_ZOOM_MIN, PREVIEW_ZOOM_MAX);
    applyPreviewTransform();
  };

  const panPreview = (x: number, y: number) => {
    previewPanX = clamp(x, -PREVIEW_PAN_LIMIT, PREVIEW_PAN_LIMIT);
    previewPanY = clamp(y, -PREVIEW_PAN_LIMIT, PREVIEW_PAN_LIMIT);
    applyPreviewTransform();
  };

  const endPreviewPointer = () => {
    activePointer = undefined;
    previewViewport?.classList.remove('is-dragging');
    previewLayer?.classList.remove('is-dragging');
  };

  previewViewport?.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    activePointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: previewPanX,
      panY: previewPanY,
    };
    previewViewport.setPointerCapture(event.pointerId);
    previewViewport.classList.add('is-dragging');
    previewLayer?.classList.add('is-dragging');
  });

  previewViewport?.addEventListener('pointermove', (event) => {
    if (!activePointer || activePointer.id !== event.pointerId) return;
    event.preventDefault();
    panPreview(
      activePointer.panX + event.clientX - activePointer.startX,
      activePointer.panY + event.clientY - activePointer.startY,
    );
  });

  previewViewport?.addEventListener('pointerup', endPreviewPointer);
  previewViewport?.addEventListener('pointercancel', endPreviewPointer);
  previewViewport?.addEventListener('lostpointercapture', endPreviewPointer);
  previewViewport?.addEventListener('wheel', (event) => {
    event.preventDefault();
    setPreviewZoom(previewScale + (event.deltaY < 0 ? PREVIEW_ZOOM_STEP : -PREVIEW_ZOOM_STEP));
  }, { passive: false });

  previewActions.forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.previewAction;
      if (action === 'zoom-in') setPreviewZoom(previewScale + PREVIEW_ZOOM_STEP);
      if (action === 'zoom-out') setPreviewZoom(previewScale - PREVIEW_ZOOM_STEP);
      if (action === 'fit') fitPreview();
    });
  });

  previewViewport?.addEventListener('keydown', (event) => {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      setPreviewZoom(previewScale + PREVIEW_ZOOM_STEP);
    }
    if (event.key === '-') {
      event.preventDefault();
      setPreviewZoom(previewScale - PREVIEW_ZOOM_STEP);
    }
    if (event.key === '0') {
      event.preventDefault();
      fitPreview();
    }
    const panStep = event.shiftKey ? 80 : 32;
    if (event.key === 'ArrowLeft') panPreview(previewPanX - panStep, previewPanY);
    if (event.key === 'ArrowRight') panPreview(previewPanX + panStep, previewPanY);
    if (event.key === 'ArrowUp') panPreview(previewPanX, previewPanY - panStep);
    if (event.key === 'ArrowDown') panPreview(previewPanX, previewPanY + panStep);
  });

  applyPreviewTransform();

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
      // Export and clipboard handlers arrive in Phase 5; keep the affordances honest until then.
      button.disabled = true;
    });
  };

  const readThemeOptions = (): MermaidThemeOptions => {
    const computed = getComputedStyle(workbench);
    const read = (name: string, fallback: string) => computed.getPropertyValue(name).trim() || fallback;
    const fontSize = Number.parseInt(read('--diagram-font-size', '16px'), 10);

    return {
      background: read('--diagram-surface', '#f4f1e8'),
      primaryColor: read('--diagram-primary', '#d8eceb'),
      primaryBorderColor: read('--diagram-border', '#50727c'),
      primaryTextColor: read('--diagram-text', '#20303a'),
      lineColor: read('--diagram-line', '#50727c'),
      accentColor: read('--diagram-accent', '#69e6f7'),
      fontFamily: read('--diagram-font', 'IBM Plex Sans, ui-sans-serif, sans-serif'),
      fontSize: Number.isFinite(fontSize) ? fontSize : 16,
      transparent: stage?.classList.contains('is-transparent') ?? false,
    };
  };

  const clearRenderedArtifact = () => {
    if (svgHost) {
      svgHost.replaceChildren();
      svgHost.hidden = true;
    }
    if (scaffoldPreview) scaffoldPreview.hidden = false;
  };

  const handleRenderError = (error: unknown) => {
    const isTimeout = error instanceof MermaidRenderError && error.code === 'RENDER_TIMEOUT';
    const hasArtifact = workbench.dataset.hasArtifact === 'true';
    applyRenderState(isTimeout ? 'timeout' : 'error', {
      hasArtifact,
      message: hasArtifact ? messages.lastValidPreview : undefined,
      detail: error instanceof MermaidRenderError ? error.message : messages.errorFallback,
    });
  };

  requestRender = () => {
    if (!sourceInput) return;
    if (renderTimer) clearTimeout(renderTimer);

    const source = sourceInput.value;
    if (!source.trim()) {
      renderRequestToken += 1;
      clearRenderedArtifact();
      applyRenderState('empty', { hasArtifact: false });
      return;
    }

    const requestToken = renderRequestToken += 1;
    const hasArtifact = workbench.dataset.hasArtifact === 'true';
    applyRenderState('rendering', { hasArtifact });

    renderTimer = setTimeout(async () => {
      try {
        const outcome = await renderCoordinator.enqueue(source, {
          theme: readThemeOptions(),
        });

        if (outcome.status === 'superseded' || requestToken !== renderRequestToken) return;

        if (svgHost) {
          svgHost.replaceChildren();
          svgHost.innerHTML = outcome.result.svg;
          outcome.result.bindFunctions?.(svgHost);
          svgHost.hidden = false;
        }
        if (scaffoldPreview) scaffoldPreview.hidden = true;
        applyRenderState('ready', { hasArtifact: true });
      } catch (error) {
        if (requestToken === renderRequestToken) handleRenderError(error);
      }
    }, 300);
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
    button.addEventListener('click', () => {
      applyPreset(button.dataset.preset ?? 'light');
      requestRender();
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

  workbench.querySelectorAll<HTMLInputElement>('[data-color-variable]').forEach((input) => {
    input.addEventListener('input', () => {
      const variable = input.dataset.colorVariable;
      if (!variable) return;
      workbench.style.setProperty(variable, input.value);
      const output = workbench.querySelector<HTMLElement>(`[data-color-value="${input.id}"]`);
      if (output) output.textContent = input.value;
      markCustom();
      requestRender();
    });
  });

  fontSelect?.addEventListener('change', () => {
    workbench.style.setProperty('--diagram-font', fontSelect.value);
    markCustom();
    requestRender();
  });

  textSizeInput?.addEventListener('input', () => {
    const value = `${textSizeInput.value}px`;
    workbench.style.setProperty('--diagram-font-size', value);
    if (textSizeOutput) textSizeOutput.value = value;
    markCustom();
    requestRender();
  });

  transparentToggle?.addEventListener('change', () => {
    stage?.classList.toggle('is-transparent', transparentToggle.checked);
    markCustom();
    requestRender();
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
    requestRender();
  });

  const updateSourceCount = () => {
    if (sourceCount && sourceInput) sourceCount.textContent = `${sourceInput.value.length} ${messages.sourceCount}`;
  };

  sourceInput?.addEventListener('input', () => {
    updateSourceCount();
    requestRender();
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
  requestRender();
}
