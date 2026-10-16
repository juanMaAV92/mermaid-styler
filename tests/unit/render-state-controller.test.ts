import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '../../src/i18n/messages.en';
import { RENDERING_OVERLAY_DELAY_MS } from '../../src/lib/ui/render-state';
import { announceAction, createRenderStateController } from '../../src/scripts/render-state-controller';

const setup = () => {
  document.body.replaceChildren();
  const workbench = document.createElement('div');
  const stage = document.createElement('div');
  const readyView = document.createElement('div');
  readyView.dataset.stateView = 'ready';
  const renderingView = document.createElement('div');
  renderingView.dataset.stateView = 'rendering';
  const emptyView = document.createElement('div');
  emptyView.dataset.stateView = 'empty';
  const stamp = document.createElement('span');
  const feedback = document.createElement('div');
  const badge = document.createElement('span');
  const liveStatus = document.createElement('span');
  const button = document.createElement('button');
  const sourceInput = document.createElement('textarea');
  sourceInput.setAttribute('aria-describedby', 'source-hint source-feedback');
  const feedbackTitle = document.createElement('strong');
  const feedbackBody = document.createElement('pre');
  feedback.append(feedbackTitle, feedbackBody);
  stage.append(readyView, renderingView, emptyView, stamp);
  workbench.append(stage, feedback, badge, liveStatus, button);
  document.body.append(workbench);
  const controller = createRenderStateController({
    workbench,
    stage,
    stageStateViews: [readyView, renderingView, emptyView],
    lastValidStamp: stamp,
    sourceFeedback: feedback,
    sourceFeedbackTitle: feedbackTitle,
    sourceFeedbackBody: feedbackBody,
    sourceInput,
    stateBadge: badge,
    liveStatus,
    actionButtons: [button],
    messages,
  });
  return { controller, workbench, stage, readyView, renderingView, stamp, feedback, feedbackTitle, feedbackBody, sourceInput, badge, liveStatus, button };
};

describe('render state controller', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('marks actions stale while the artifact does not match the source and clears it on ready', () => {
    const ui = setup();
    ui.button.title = 'Copy SVG';
    ui.controller.setRenderState('ready', { hasArtifact: true });
    expect(ui.button.dataset.stale).toBeUndefined();
    ui.controller.setRenderState('error', { hasArtifact: true });
    expect(ui.button.dataset.stale).toBe('true');
    expect(ui.button.title).toBe(messages.exportsLastValid);
    ui.controller.setRenderState('ready', { hasArtifact: true });
    expect(ui.button.dataset.stale).toBeUndefined();
    expect(ui.button.title).toBe('Copy SVG');
  });

  it('keeps the previous artifact visible and actions enabled while rendering', () => {
    const ui = setup();
    ui.controller.setRenderState('ready', { hasArtifact: true });
    ui.controller.setRenderState('rendering');
    expect(ui.readyView.hidden).toBe(false);
    expect(ui.renderingView.hidden).toBe(true);
    expect(ui.button.disabled).toBe(false);
  });

  it('shows the rendering view only when there is no artifact yet', () => {
    const ui = setup();
    ui.controller.setRenderState('rendering', { hasArtifact: false });
    expect(ui.renderingView.hidden).toBe(false);
    expect(ui.button.disabled).toBe(true);
  });

  it('adds the rendering overlay only after the overlay delay and removes it on completion', () => {
    const ui = setup();
    ui.controller.setRenderState('ready', { hasArtifact: true });
    ui.controller.setRenderState('rendering');
    vi.advanceTimersByTime(RENDERING_OVERLAY_DELAY_MS - 1);
    expect(ui.stage.classList.contains('stage-rendering-overlay')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(ui.stage.classList.contains('stage-rendering-overlay')).toBe(true);
    ui.controller.setRenderState('ready', { hasArtifact: true });
    expect(ui.stage.classList.contains('stage-rendering-overlay')).toBe(false);
  });

  it('shows a neutral editing indicator without announcing or revealing the error', () => {
    const ui = setup();
    ui.controller.setRenderState('ready', { hasArtifact: true });
    const announced = ui.liveStatus.textContent;
    ui.controller.setRenderState('rendering', { editing: true });
    expect(ui.badge.textContent).toBe(messages.editing);
    expect(ui.feedback.hidden).toBe(true);
    expect(ui.liveStatus.textContent).toBe(announced);
  });

  it('marks the last valid artifact in error state', () => {
    const ui = setup();
    ui.controller.setRenderState('ready', { hasArtifact: true });
    expect(ui.stamp.hidden).toBe(true);
    ui.controller.setRenderState('error', { title: 'Parse error' });
    expect(ui.stamp.hidden).toBe(false);
    expect(ui.feedback.hidden).toBe(false);
    expect(ui.button.disabled).toBe(false);
  });

  it('does not rewrite the live region with identical text or for rendering', () => {
    const ui = setup();
    ui.controller.setRenderState('ready', { hasArtifact: true });
    const node = ui.liveStatus.firstChild;
    const text = ui.liveStatus.textContent;
    ui.controller.setRenderState('rendering');
    expect(ui.liveStatus.textContent).toBe(text);
    ui.controller.setRenderState('ready', { hasArtifact: true });
    expect(ui.liveStatus.firstChild).toBe(node);
  });

  it('announces a repeated action confirmation every time', () => {
    const ui = setup();
    const updates: string[] = [];
    new MutationObserver(() => updates.push(ui.liveStatus.textContent ?? '')).observe(ui.liveStatus, { childList: true, characterData: true, subtree: true });
    announceAction(ui.liveStatus, 'SVG copied.');
    vi.runAllTimers();
    expect(ui.liveStatus.textContent).toBe('SVG copied.');
    announceAction(ui.liveStatus, 'SVG copied.');
    expect(ui.liveStatus.textContent).toBe('');
    vi.runAllTimers();
    expect(ui.liveStatus.textContent).toBe('SVG copied.');
  });

  it('describes the editor with the feedback only while an error is revealed', () => {
    const ui = setup();
    ui.controller.setRenderState('ready', { hasArtifact: true });
    expect(ui.sourceInput.getAttribute('aria-describedby')).toBe('source-hint');
    expect(ui.feedbackTitle.textContent).toBe('');
    expect(ui.feedbackBody.textContent).toBe('');
    ui.controller.setRenderState('rendering', { editing: true });
    expect(ui.sourceInput.getAttribute('aria-describedby')).toBe('source-hint');
    ui.controller.setRenderState('error', { title: 'Syntax error on line 2', detail: 'Parse error' });
    expect(ui.sourceInput.getAttribute('aria-describedby')).toBe('source-hint source-feedback');
    expect(ui.feedbackTitle.textContent).toBe('Syntax error on line 2');
    ui.controller.setRenderState('ready', { hasArtifact: true });
    expect(ui.sourceInput.getAttribute('aria-describedby')).toBe('source-hint');
    expect(ui.feedbackTitle.textContent).toBe('');
    expect(ui.feedbackBody.textContent).toBe('');
  });

  it('includes the error title in the announcement so consecutive different errors are both announced', () => {
    const ui = setup();
    ui.controller.setRenderState('ready', { hasArtifact: true });
    ui.controller.setRenderState('error', { title: 'Syntax error on line 2' });
    expect(ui.liveStatus.textContent).toContain('Syntax error on line 2');
    ui.controller.setRenderState('error', { title: 'Syntax error on line 3' });
    expect(ui.liveStatus.textContent).toContain('Syntax error on line 3');
  });
});
