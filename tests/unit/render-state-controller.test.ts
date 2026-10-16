import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '../../src/i18n/messages.en';
import { RENDERING_OVERLAY_DELAY_MS } from '../../src/lib/ui/render-state';
import { createRenderStateController } from '../../src/scripts/render-state-controller';

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
  stage.append(readyView, renderingView, emptyView, stamp);
  workbench.append(stage, feedback, badge, liveStatus, button);
  document.body.append(workbench);
  const controller = createRenderStateController({
    workbench,
    stage,
    stageStateViews: [readyView, renderingView, emptyView],
    lastValidStamp: stamp,
    sourceFeedback: feedback,
    stateBadge: badge,
    liveStatus,
    actionButtons: [button],
    messages,
  });
  return { controller, workbench, stage, readyView, renderingView, stamp, feedback, badge, liveStatus, button };
};

describe('render state controller', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

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
});
