import messages from '../i18n/messages.en';
import { MermaidRenderError } from '../lib/mermaid/types';
import type { MermaidRenderResult, RenderMermaidOptions } from '../lib/mermaid/types';
import { LatestWinsRenderCoordinator } from '../lib/mermaid/render-coordinator';
import { isRenderState, type RenderState } from '../lib/ui/render-state';
import { addSvgMetadata } from '../lib/export/svg';
import { createArtifactActionHandler } from './artifact-actions';
import { initPreviewControls } from './preview-controls';
import { createRenderStateController, type RenderStateOptions } from './render-state-controller';
import { initThemeControls } from './theme-controls';

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
  const includeSourceToggle = workbench.querySelector<HTMLInputElement>('[data-include-source-toggle]');
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

  const getRenderedSvg = () => svgHost?.querySelector<SVGSVGElement>('svg');

  const getRenderedSvgMarkup = () => {
    const svg = getRenderedSvg();
    if (!svg) throw new Error('No rendered SVG is available.');
    return svg.outerHTML;
  };

  const getExportSvgMarkup = () => addSvgMetadata(getRenderedSvgMarkup(), {
    title: messages.exportTitle,
    description: messages.exportDescription,
    source: includeSourceToggle?.checked ? sourceInput?.value ?? '' : undefined,
  });

  const announceArtifactAction = (message: string) => {
    if (liveStatus) liveStatus.textContent = message;
  };

  initPreviewControls({
    viewport: previewViewport,
    layer: previewLayer,
    zoom: previewZoom,
    actions: previewActions,
  });

  const renderStateController = createRenderStateController({
    workbench,
    stage,
    stageStatus,
    stageCaption,
    stageStateViews,
    stageNotices,
    sourceFeedback,
    sourceFeedbackTitle,
    sourceFeedbackBody,
    stateBadge,
    liveStatus,
    actionButtons,
    messages,
  });
  const applyRenderState = renderStateController.setRenderState;

  const themeControls = initThemeControls({
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
    customPresetLabel: messages.customPreset,
    onChange: () => requestRender(),
  });

  const handleArtifactAction = createArtifactActionHandler({
    getRenderedSvg,
    getExportSvgMarkup,
    getPngOptions: themeControls.getPngOptions,
    messages,
    announce: announceArtifactAction,
  });

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
          theme: themeControls.getMermaidThemeOptions(),
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

  updateSourceCount();
  actionButtons.forEach((button) => {
    button.addEventListener('click', () => void handleArtifactAction(button.dataset.action ?? ''));
    button.disabled = true;
  });
  requestRender();
}
