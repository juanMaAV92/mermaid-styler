type PreviewControlsOptions = {
  viewport?: HTMLElement | null;
  layer?: HTMLElement | null;
  zoom?: HTMLOutputElement | null;
  actions: HTMLButtonElement[];
};

const PREVIEW_ZOOM_MIN = 0.5;
const PREVIEW_ZOOM_MAX = 4;
const PREVIEW_ZOOM_STEP = 0.25;
const PREVIEW_PAN_LIMIT = 1200;

export const initPreviewControls = ({ viewport, layer, zoom, actions }: PreviewControlsOptions) => {
  let previewScale = 1;
  let previewPanX = 0;
  let previewPanY = 0;
  let activePointer: { id: number; startX: number; startY: number; panX: number; panY: number } | undefined;
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  const applyTransform = () => {
    if (!layer) return;
    layer.style.setProperty('--preview-scale', String(previewScale));
    layer.style.setProperty('--preview-pan-x', `${previewPanX}px`);
    layer.style.setProperty('--preview-pan-y', `${previewPanY}px`);
    if (zoom) zoom.value = `${Math.round(previewScale * 100)}%`;
  };

  const fit = () => {
    previewScale = 1;
    previewPanX = 0;
    previewPanY = 0;
    applyTransform();
  };

  const setZoom = (nextScale: number) => {
    previewScale = clamp(nextScale, PREVIEW_ZOOM_MIN, PREVIEW_ZOOM_MAX);
    applyTransform();
  };

  const pan = (x: number, y: number) => {
    previewPanX = clamp(x, -PREVIEW_PAN_LIMIT, PREVIEW_PAN_LIMIT);
    previewPanY = clamp(y, -PREVIEW_PAN_LIMIT, PREVIEW_PAN_LIMIT);
    applyTransform();
  };

  const endPointer = () => {
    activePointer = undefined;
    viewport?.classList.remove('is-dragging');
    layer?.classList.remove('is-dragging');
  };

  viewport?.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    activePointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: previewPanX,
      panY: previewPanY,
    };
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('is-dragging');
    layer?.classList.add('is-dragging');
  });

  viewport?.addEventListener('pointermove', (event) => {
    if (!activePointer || activePointer.id !== event.pointerId) return;
    event.preventDefault();
    pan(activePointer.panX + event.clientX - activePointer.startX, activePointer.panY + event.clientY - activePointer.startY);
  });
  viewport?.addEventListener('pointerup', endPointer);
  viewport?.addEventListener('pointercancel', endPointer);
  viewport?.addEventListener('lostpointercapture', endPointer);
  viewport?.addEventListener('wheel', (event) => {
    event.preventDefault();
    setZoom(previewScale + (event.deltaY < 0 ? PREVIEW_ZOOM_STEP : -PREVIEW_ZOOM_STEP));
  }, { passive: false });

  actions.forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.previewAction;
      if (action === 'zoom-in') setZoom(previewScale + PREVIEW_ZOOM_STEP);
      if (action === 'zoom-out') setZoom(previewScale - PREVIEW_ZOOM_STEP);
      if (action === 'fit') fit();
    });
  });

  viewport?.addEventListener('keydown', (event) => {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      setZoom(previewScale + PREVIEW_ZOOM_STEP);
    }
    if (event.key === '-') {
      event.preventDefault();
      setZoom(previewScale - PREVIEW_ZOOM_STEP);
    }
    if (event.key === '0') {
      event.preventDefault();
      fit();
    }
    const panStep = event.shiftKey ? 80 : 32;
    if (event.key === 'ArrowLeft') pan(previewPanX - panStep, previewPanY);
    if (event.key === 'ArrowRight') pan(previewPanX + panStep, previewPanY);
    if (event.key === 'ArrowUp') pan(previewPanX, previewPanY - panStep);
    if (event.key === 'ArrowDown') pan(previewPanX, previewPanY + panStep);
  });

  applyTransform();
};
