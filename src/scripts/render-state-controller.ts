import type { RenderState } from '../lib/ui/render-state';

export type RenderStateOptions = {
  message?: string;
  detail?: string;
  hasArtifact?: boolean;
};

type RenderStateMessages = {
  stateEmpty: string;
  emptyState: string;
  stateRendering: string;
  renderingState: string;
  stateReady: string;
  readyState: string;
  stateInvalid: string;
  invalidStateHint: string;
  stateTimeout: string;
  timeoutStateHint: string;
  statusAnnounce: string;
  errorFallback: string;
};

type RenderStateControllerOptions = {
  workbench: HTMLElement;
  stage?: HTMLElement | null;
  stageStatus?: HTMLElement | null;
  stageCaption?: HTMLElement | null;
  stageStateViews: HTMLElement[];
  stageNotices: HTMLElement[];
  sourceFeedback?: HTMLElement | null;
  sourceFeedbackTitle?: HTMLElement | null;
  sourceFeedbackBody?: HTMLElement | null;
  stateBadge?: HTMLElement | null;
  liveStatus?: HTMLElement | null;
  actionButtons: HTMLButtonElement[];
  messages: RenderStateMessages;
};

export const createRenderStateController = ({
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
}: RenderStateControllerOptions) => {
  const stateCopy: Record<RenderState, { label: string; caption: string }> = {
    empty: { label: messages.stateEmpty, caption: messages.emptyState },
    rendering: { label: messages.stateRendering, caption: messages.renderingState },
    ready: { label: messages.stateReady, caption: messages.readyState },
    error: { label: messages.stateInvalid, caption: messages.invalidStateHint },
    timeout: { label: messages.stateTimeout, caption: messages.timeoutStateHint },
  };

  const setRenderState = (state: RenderState, options: RenderStateOptions = {}) => {
    if (options.hasArtifact !== undefined) workbench.dataset.hasArtifact = String(options.hasArtifact);

    const hasArtifact = workbench.dataset.hasArtifact === 'true';
    const isError = state === 'error' || state === 'timeout';
    const baseState = isError ? (hasArtifact ? 'ready' : 'empty') : state;
    const copy = stateCopy[state];

    workbench.dataset.renderState = state;
    if (stage) stage.dataset.renderState = state;
    stageStateViews.forEach((view) => { view.hidden = view.dataset.stateView !== baseState; });
    stageNotices.forEach((notice) => { notice.hidden = notice.dataset.stateNotice !== state || !isError; });
    if (stageStatus) stageStatus.textContent = copy.label;
    if (stageCaption) stageCaption.textContent = options.message ?? copy.caption;

    if (stateBadge) {
      stateBadge.textContent = copy.label;
      stateBadge.classList.toggle('status-badge--active', state === 'ready');
      stateBadge.classList.toggle('status-badge--warning', isError);
    }
    if (liveStatus) liveStatus.textContent = `${messages.statusAnnounce}: ${copy.label}. ${options.message ?? copy.caption}`;

    if (sourceFeedback) sourceFeedback.hidden = !isError;
    if (sourceFeedbackTitle) sourceFeedbackTitle.textContent = copy.label;
    if (sourceFeedbackBody) {
      sourceFeedbackBody.textContent = options.detail ?? (state === 'timeout' ? messages.timeoutStateHint : messages.errorFallback);
    }

    const canUseArtifact = hasArtifact && state !== 'empty' && state !== 'rendering';
    actionButtons.forEach((button) => { button.disabled = !canUseArtifact; });
  };

  return { setRenderState };
};
