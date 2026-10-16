import { formatMessage } from '../i18n/format';
import { RENDERING_OVERLAY_DELAY_MS, type RenderState } from '../lib/ui/render-state';

export type RenderStateOptions = {
  message?: string;
  detail?: string;
  title?: string;
  line?: number;
  hasArtifact?: boolean;
  /** Neutral "editing" indicator: a render error is pending reveal and must not be shown or announced yet. */
  editing?: boolean;
  /** The source being rendered/edited differs from the one behind the displayed artifact. */
  stale?: boolean;
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
  goToLine: string;
  editing: string;
  exportsLastValid: string;
};

type RenderStateControllerOptions = {
  workbench: HTMLElement;
  stage?: HTMLElement | null;
  stageStatus?: HTMLElement | null;
  stageCaption?: HTMLElement | null;
  stageStateViews: HTMLElement[];
  lastValidStamp?: HTMLElement | null;
  sourceFeedback?: HTMLElement | null;
  sourceInput?: HTMLTextAreaElement | null;
  sourceFeedbackTitle?: HTMLElement | null;
  sourceFeedbackBody?: HTMLElement | null;
  goToLineButton?: HTMLButtonElement | null;
  stateBadge?: HTMLElement | null;
  liveStatus?: HTMLElement | null;
  actionButtons: HTMLButtonElement[];
  messages: RenderStateMessages;
};

export const RENDERING_OVERLAY_CLASS = 'stage-rendering-overlay';

/** Render-state announcements: write to the single live region only when the text changes, so each distinct state is announced once. */
export const announce = (liveStatus: HTMLElement | null | undefined, text: string) => {
  if (liveStatus && liveStatus.textContent !== text) liveStatus.textContent = text;
};

const ACTION_ANNOUNCE_DELAY_MS = 50;
const pendingActionAnnouncements = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

/**
 * Action confirmations (copy/export) must be announced every time, even when the text repeats:
 * clear the live region, then set the text on a later task so assistive tech sees a change.
 */
export const announceAction = (liveStatus: HTMLElement | null | undefined, text: string) => {
  if (!liveStatus) return;
  const pending = pendingActionAnnouncements.get(liveStatus);
  if (pending) clearTimeout(pending);
  liveStatus.textContent = '';
  pendingActionAnnouncements.set(liveStatus, setTimeout(() => {
    pendingActionAnnouncements.delete(liveStatus);
    liveStatus.textContent = text;
  }, ACTION_ANNOUNCE_DELAY_MS));
};

const SOURCE_HINT_ID = 'source-hint';
const SOURCE_FEEDBACK_ID = 'source-feedback';

export const createRenderStateController = ({
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
}: RenderStateControllerOptions) => {
  const stateCopy: Record<RenderState, { label: string; caption: string }> = {
    empty: { label: messages.stateEmpty, caption: messages.emptyState },
    rendering: { label: messages.stateRendering, caption: messages.renderingState },
    ready: { label: messages.stateReady, caption: messages.readyState },
    error: { label: messages.stateInvalid, caption: messages.invalidStateHint },
    timeout: { label: messages.stateTimeout, caption: messages.timeoutStateHint },
  };
  let overlayTimer: ReturnType<typeof setTimeout> | undefined;

  const clearOverlay = () => {
    if (overlayTimer) clearTimeout(overlayTimer);
    overlayTimer = undefined;
    stage?.classList.remove(RENDERING_OVERLAY_CLASS);
  };

  const setRenderState = (state: RenderState, options: RenderStateOptions = {}) => {
    if (options.hasArtifact !== undefined) workbench.dataset.hasArtifact = String(options.hasArtifact);

    const hasArtifact = workbench.dataset.hasArtifact === 'true';
    const isError = state === 'error' || state === 'timeout';
    const isRendering = state === 'rendering';
    const editing = Boolean(options.editing);
    const keepsArtifactView = isError || editing || (isRendering && hasArtifact);
    const baseState = keepsArtifactView ? (hasArtifact ? 'ready' : 'empty') : state;
    const copy = stateCopy[state];
    const label = editing ? messages.editing : copy.label;

    workbench.dataset.renderState = state;
    if (stage) stage.dataset.renderState = state;
    stageStateViews.forEach((view) => { view.hidden = view.dataset.stateView !== baseState; });
    if (lastValidStamp) lastValidStamp.hidden = !(isError && hasArtifact);
    if (stageStatus) stageStatus.textContent = label;
    if (stageCaption) stageCaption.textContent = options.message ?? (editing ? (hasArtifact ? messages.readyState : messages.emptyState) : copy.caption);

    // The overlay dims the previous artifact only once a render has been pending for a while;
    // every new request restarts the countdown so continuous typing never dims the preview.
    if (isRendering && hasArtifact && !editing) {
      if (!stage?.classList.contains(RENDERING_OVERLAY_CLASS)) {
        if (overlayTimer) clearTimeout(overlayTimer);
        overlayTimer = setTimeout(() => {
          overlayTimer = undefined;
          stage?.classList.add(RENDERING_OVERLAY_CLASS);
        }, RENDERING_OVERLAY_DELAY_MS);
      }
    } else {
      clearOverlay();
    }

    if (stateBadge) {
      stateBadge.textContent = label;
      stateBadge.classList.toggle('status-badge--active', state === 'ready');
      stateBadge.classList.toggle('status-badge--warning', isError);
    }
    // Rendering and editing are transient; only settled states reach the live region.
    if (!isRendering && !editing) {
      const errorTitle = isError && options.title ? `${options.title}. ` : '';
      announce(liveStatus, `${messages.statusAnnounce}: ${copy.label}. ${errorTitle}${options.message ?? copy.caption}`);
    }

    if (sourceFeedback) sourceFeedback.hidden = !isError;
    // The editor references the feedback only while an error is revealed, so a hidden or stale message is never read on focus.
    sourceInput?.setAttribute('aria-describedby', isError ? `${SOURCE_HINT_ID} ${SOURCE_FEEDBACK_ID}` : SOURCE_HINT_ID);
    if (sourceFeedbackTitle) sourceFeedbackTitle.textContent = isError ? options.title ?? copy.label : '';
    if (sourceFeedbackBody) {
      sourceFeedbackBody.textContent = isError
        ? options.detail ?? (state === 'timeout' ? messages.timeoutStateHint : messages.errorFallback)
        : '';
    }

    if (goToLineButton) {
      const line = isError ? options.line : undefined;
      goToLineButton.hidden = line === undefined;
      if (line !== undefined) {
        goToLineButton.textContent = formatMessage(messages.goToLine, { line });
        goToLineButton.dataset.line = String(line);
      } else {
        delete goToLineButton.dataset.line;
      }
    }

    const canUseArtifact = hasArtifact && state !== 'empty';
    // Between a render request and its success (or after a failure) the preview is the last valid one, so exports are stale.
    const stale = hasArtifact && (isError || Boolean(options.stale));
    actionButtons.forEach((button) => {
      button.disabled = !canUseArtifact;
      if (button.dataset.baseTitle === undefined) button.dataset.baseTitle = button.title;
      if (stale) {
        button.dataset.stale = 'true';
        button.title = messages.exportsLastValid;
      } else {
        delete button.dataset.stale;
        button.title = button.dataset.baseTitle;
      }
    });
  };

  return { setRenderState };
};
