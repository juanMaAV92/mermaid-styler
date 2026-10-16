import messages from '../i18n/messages.en';
import { formatRenderError } from '../lib/mermaid/format-error';
import { MermaidRenderError } from '../lib/mermaid/types';
import type { MermaidRenderResult, RenderMermaidOptions } from '../lib/mermaid/types';
import { sourceThemeNoticeKey } from '../lib/mermaid/directives';
import { LatestWinsRenderCoordinator } from '../lib/mermaid/render-coordinator';
import { ERROR_REVEAL_MS, RENDER_DEBOUNCE_MS, isRenderState, type RenderState } from '../lib/ui/render-state';
import { addSvgMetadata } from '../lib/export/svg';
import { createArtifactActionHandler } from './artifact-actions';
import { hasSignificantSizeChange, type Size } from '../lib/ui/preview-geometry';
import { initPreviewControls, readSvgIntrinsicSize } from './preview-controls';
import { announceAction, createRenderStateController, type RenderStateOptions } from './render-state-controller';
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
  const svgHost = workbench.querySelector<HTMLElement>('[data-svg-host]');
  const previewViewport = workbench.querySelector<HTMLElement>('[data-preview-viewport]');
  const previewLayer = workbench.querySelector<HTMLElement>('[data-preview-layer]');
  const previewControlsBar = workbench.querySelector<HTMLElement>('[data-preview-controls]');
  const previewZoom = workbench.querySelector<HTMLElement>('[data-preview-zoom]');
  const previewLargeHint = workbench.querySelector<HTMLElement>('[data-preview-large-hint]');
  const previewActions = [...workbench.querySelectorAll<HTMLButtonElement>('[data-preview-action]')];
  const stageStatus = workbench.querySelector<HTMLElement>('[data-stage-status]');
  const stageCaption = workbench.querySelector<HTMLElement>('[data-stage-caption-text]');
  const stageStateViews = [...workbench.querySelectorAll<HTMLElement>('[data-state-view]')];
  const lastValidStamp = workbench.querySelector<HTMLElement>('[data-last-valid-stamp]');
  const currentPreset = workbench.querySelector<HTMLElement>('[data-current-preset]');
  const presetList = workbench.querySelector<HTMLElement>('[role="listbox"]');
  const presetButtons = [...workbench.querySelectorAll<HTMLButtonElement>('[data-preset]')];
  const textSizeInput = workbench.querySelector<HTMLInputElement>('[data-text-size-input]');
  const textSizeOutput = workbench.querySelector<HTMLElement>('[data-text-size]');
  const fontSelect = workbench.querySelector<HTMLSelectElement>('[data-font-select]');
  const transparentToggle = workbench.querySelector<HTMLInputElement>('[data-transparent-toggle]');
  const sourceThemeToggle = workbench.querySelector<HTMLInputElement>('[data-source-theme-toggle]');
  const sourceThemeNotice = workbench.querySelector<HTMLElement>('[data-source-theme-notice]');
  const includeSourceToggle = workbench.querySelector<HTMLInputElement>('[data-include-source-toggle]');
  const resetButton = workbench.querySelector<HTMLButtonElement>('[data-reset-styles]');
  const sourceFeedback = workbench.querySelector<HTMLElement>('[data-source-feedback]');
  const sourceFeedbackTitle = workbench.querySelector<HTMLElement>('[data-source-feedback-title]');
  const sourceFeedbackBody = workbench.querySelector<HTMLElement>('[data-source-feedback-body]');
  const goToLineButton = workbench.querySelector<HTMLButtonElement>('[data-go-to-line]');
  const stateBadge = workbench.querySelector<HTMLElement>('[data-state-badge]');
  const liveStatus = workbench.querySelector<HTMLElement>('[data-live-status]');
  const actionButtons = [...workbench.querySelectorAll<HTMLButtonElement>('[data-action]')];
  const renderCoordinator = new LatestWinsRenderCoordinator<RenderMermaidOptions, MermaidRenderResult>(async (source, options) => {
    const { renderMermaid } = await import('../lib/mermaid/render-mermaid');
    return renderMermaid(source, options);
  });
  let renderTimer: ReturnType<typeof setTimeout> | undefined;
  let errorRevealTimer: ReturnType<typeof setTimeout> | undefined;
  let revealPendingError: (() => void) | undefined;
  // -Infinity means "no recent typing": errors from style changes or the first render show immediately.
  let lastSourceInputAt = Number.NEGATIVE_INFINITY;
  let renderRequestToken = 0;
  let requestRender = () => undefined;
  // The source that produced the SVG currently in the preview; exports embed this, never the live textarea.
  let lastRenderedSource = '';
  let lastRenderDroppedStyle = false;

  const getRenderedSvg = () => svgHost?.querySelector<SVGSVGElement>('svg');

  const getRenderedSvgMarkup = () => {
    const svg = getRenderedSvg();
    if (!svg) throw new Error('No rendered SVG is available.');
    // XML serialization keeps foreignObject HTML children (e.g. <br/>) well-formed; outerHTML would emit HTML rules.
    return new XMLSerializer().serializeToString(svg);
  };

  const getExportSvgMarkup = () => addSvgMetadata(getRenderedSvgMarkup(), {
    title: messages.exportTitle,
    description: messages.exportDescription,
    source: includeSourceToggle?.checked ? lastRenderedSource : undefined,
  });

  const announceArtifactAction = (message: string) => announceAction(liveStatus, message);

  // Declared before use by the getFontSize closure; assigned once the theme controls exist.
  let getDiagramFontSize = () => 0;
  const previewControls = initPreviewControls({
    viewport: previewViewport,
    layer: previewLayer,
    zoom: previewZoom,
    largeDiagramHint: previewLargeHint,
    controls: previewControlsBar,
    getFontSize: () => getDiagramFontSize(),
    actions: previewActions,
  });
  // Refit only when the diagram is new in kind or size; style-only re-renders keep the author's zoom and pan.
  let lastFitDiagramType: string | undefined;
  let lastFitSize: Size | undefined;

  const renderStateController = createRenderStateController({
    workbench,
    stage,
    stageStatus,
    stageCaption,
    stageStateViews,
    lastValidStamp,
    sourceFeedback,
    sourceInput,
    sourceFeedbackTitle,
    sourceFeedbackBody,
    goToLineButton,
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
    presetLabels: {
      light: messages.presetLight,
      dark: messages.presetDark,
      terminal: messages.presetTerminal,
      paper: messages.presetPaper,
      architecture: messages.presetArchitecture,
    },
    customPresetLabel: messages.customPreset,
    onChange: () => requestRender(),
  });

  getDiagramFontSize = () => themeControls.getMermaidThemeOptions().fontSize;

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
    lastRenderDroppedStyle = false;
  };

  goToLineButton?.addEventListener('click', () => {
    const line = Number(goToLineButton.dataset.line);
    if (!sourceInput || !Number.isInteger(line) || line < 1) return;
    const lines = sourceInput.value.split('\n');
    const start = lines.slice(0, Math.min(line, lines.length) - 1).reduce((sum, text) => sum + text.length + 1, 0);
    sourceInput.focus();
    sourceInput.setSelectionRange(start, start);
  });

  const cancelPendingErrorReveal = () => {
    if (errorRevealTimer) clearTimeout(errorRevealTimer);
    errorRevealTimer = undefined;
    revealPendingError = undefined;
  };

  const handleRenderError = (error: unknown, requestToken: number) => {
    const isTimeout = error instanceof MermaidRenderError && error.code === 'RENDER_TIMEOUT';
    const hasArtifact = workbench.dataset.hasArtifact === 'true';
    const formatted = formatRenderError(error, messages, (sourceInput?.value ?? '').split('\n').length);
    const message = hasArtifact ? messages.lastValidPreview : undefined;
    const reveal = () => {
      cancelPendingErrorReveal();
      if (requestToken !== renderRequestToken) return;
      applyRenderState(isTimeout ? 'timeout' : 'error', {
        hasArtifact,
        message,
        title: formatted.title,
        detail: formatted.detail,
        line: formatted.line,
      });
    };

    cancelPendingErrorReveal();
    const remaining = ERROR_REVEAL_MS - (performance.now() - lastSourceInputAt);
    if (remaining <= 0) {
      reveal();
      return;
    }
    // The author is still typing: keep the last valid preview and a neutral indicator until they pause.
    applyRenderState('rendering', { hasArtifact, editing: true, message, stale: sourceInput?.value !== lastRenderedSource });
    revealPendingError = reveal;
    errorRevealTimer = setTimeout(reveal, remaining);
  };

  requestRender = () => {
    if (!sourceInput) return;
    if (renderTimer) clearTimeout(renderTimer);
    cancelPendingErrorReveal();

    const source = sourceInput.value;
    if (!source.trim()) {
      renderRequestToken += 1;
      clearRenderedArtifact();
      applyRenderState('empty', { hasArtifact: false });
      return;
    }

    const requestToken = renderRequestToken += 1;
    const hasArtifact = workbench.dataset.hasArtifact === 'true';
    applyRenderState('rendering', { hasArtifact, stale: source !== lastRenderedSource });

    renderTimer = setTimeout(async () => {
      try {
        const outcome = await renderCoordinator.enqueue(source, {
          theme: themeControls.getMermaidThemeOptions(),
          allowSourceTheme: sourceThemeToggle?.checked ?? false,
        });

        if (outcome.status === 'superseded' || requestToken !== renderRequestToken) return;

        if (svgHost) {
          svgHost.replaceChildren(document.importNode(outcome.result.element, true));
          lastRenderedSource = source;
          lastRenderDroppedStyle = outcome.result.droppedStyle;
          updateSourceThemeNotice();
          outcome.result.bindFunctions?.(svgHost);
          svgHost.hidden = false;
        }
        applyRenderState('ready', { hasArtifact: true });
        // After 'ready' so the viewport is visible and has a real size to fit into.
        const renderedSvg = getRenderedSvg();
        const size = renderedSvg ? readSvgIntrinsicSize(renderedSvg) : undefined;
        const typeChanged = outcome.result.diagramType !== lastFitDiagramType;
        if (typeChanged || !size || hasSignificantSizeChange(lastFitSize, size)) {
          previewControls.fit();
          lastFitDiagramType = outcome.result.diagramType;
          lastFitSize = size;
        }
      } catch (error) {
        if (requestToken === renderRequestToken) handleRenderError(error, requestToken);
      }
    }, RENDER_DEBOUNCE_MS);
  };


  const updateSourceCount = () => {
    if (sourceCount && sourceInput) sourceCount.textContent = `${sourceInput.value.length} ${messages.sourceCount}`;
  };

  // D1: tell the author their source's theme is being overridden by the rail (not a live region by design).
  // M2: also say when the sanitizer dropped the rendered diagram's <style> block (it reflects the last render).
  const updateSourceThemeNotice = () => {
    if (!sourceThemeNotice) return;
    const key = sourceThemeNoticeKey({
      source: sourceInput?.value ?? '',
      allowSourceTheme: sourceThemeToggle?.checked ?? false,
      droppedStyle: lastRenderDroppedStyle,
    });
    sourceThemeNotice.hidden = !key;
    sourceThemeNotice.textContent = key ? messages[key] : '';
  };

  sourceInput?.addEventListener('input', () => {
    lastSourceInputAt = performance.now();
    updateSourceCount();
    updateSourceThemeNotice();
    requestRender();
  });

  sourceThemeToggle?.addEventListener('change', () => {
    updateSourceThemeNotice();
    requestRender();
  });

  // Reset styles returns to the default policy too: the rail wins again. Theme controls already re-render on reset.
  resetButton?.addEventListener('click', () => {
    if (sourceThemeToggle) sourceThemeToggle.checked = false;
    updateSourceThemeNotice();
  });

  // Leaving the editor means the author has stopped typing: reveal any pending error right away.
  sourceInput?.addEventListener('blur', () => {
    lastSourceInputAt = Number.NEGATIVE_INFINITY;
    revealPendingError?.();
  });

  // D3: the source is never persisted. Warn before leaving only when the author changed it away from the sample.
  const initialSource = sourceInput?.value ?? '';
  let userEdited = false;
  sourceInput?.addEventListener('input', () => { userEdited = true; });
  window.addEventListener('beforeunload', (event) => {
    if (!userEdited || sourceInput?.value === initialSource) return;
    event.preventDefault();
    event.returnValue = '';
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
  updateSourceThemeNotice();
  actionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const menu = button.closest<HTMLElement>('[popover]');
      if (menu?.matches(':popover-open')) menu.hidePopover();
      void handleArtifactAction(button.dataset.action ?? '');
    });
    button.disabled = true;
  });
  requestRender();
}
