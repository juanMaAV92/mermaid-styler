import {
  MANUAL_MAX_SCALE,
  clampScale,
  computeFitScale,
  computePanLimit,
  parseSvgIntrinsicSize,
  wheelZoomFactor,
  zoomAt,
  type Point,
  type Size,
} from '../lib/ui/preview-geometry';

type PreviewControlsOptions = {
  viewport?: HTMLElement | null;
  layer?: HTMLElement | null;
  zoom?: HTMLElement | null;
  largeDiagramHint?: HTMLElement | null;
  /** Theme font size in px; with the scale it gives the effective on-screen text size. */
  getFontSize?: () => number;
  actions: HTMLButtonElement[];
};

export type PreviewControls = {
  /** Scale the current diagram to fit the viewport and center it. */
  fit(): void;
};

/** Buttons and +/- keys multiply or divide the scale by this step. */
const ZOOM_STEP = 1.25;
const PAN_STEP = 32;
const PAN_STEP_LARGE = 80;
/** Below this effective text size (theme font size × scale) after Fit, suggest zooming in or exporting. */
const MIN_READABLE_FONT_PX = 8;
const LINE_HEIGHT_PX = 16;

export const readSvgIntrinsicSize = (svg: SVGSVGElement): Size | undefined => parseSvgIntrinsicSize({
  viewBox: svg.getAttribute('viewBox'),
  width: svg.getAttribute('width'),
  height: svg.getAttribute('height'),
});

export const initPreviewControls = ({
  viewport,
  layer,
  zoom,
  largeDiagramHint,
  getFontSize,
  actions,
}: PreviewControlsOptions): PreviewControls => {
  let scale = 1;
  let pan: Point = { x: 0, y: 0 };
  // True while the view is the result of Fit; a viewport resize then refits instead of keeping a stale scale.
  let fitted = false;
  let fitPending = false;
  let drag: { id: number; start: Point; pan: Point } | undefined;
  const touches = new Map<number, Point>();
  let pinch: { distance: number; mid: Point } | undefined;

  const getSvg = () => layer?.querySelector<SVGSVGElement>('svg') ?? undefined;
  const viewportSize = (): Size => ({ width: viewport?.clientWidth ?? 0, height: viewport?.clientHeight ?? 0 });

  const contentSize = (): Size | undefined => {
    const svg = getSvg();
    return svg ? readSvgIntrinsicSize(svg) : undefined;
  };

  /** Client coordinates → coordinates relative to the viewport center (the layer's transform origin). */
  const toCenter = (clientX: number, clientY: number): Point => {
    if (!viewport) return { x: 0, y: 0 };
    const rect = viewport.getBoundingClientRect();
    return {
      x: clientX - rect.left - viewport.clientLeft - viewport.clientWidth / 2,
      y: clientY - rect.top - viewport.clientTop - viewport.clientHeight / 2,
    };
  };

  const clampPan = (next: Point): Point => {
    const content = contentSize();
    if (!content) return { x: 0, y: 0 };
    const limit = computePanLimit(content, viewportSize(), scale);
    return {
      x: Math.min(limit.x, Math.max(-limit.x, next.x)),
      y: Math.min(limit.y, Math.max(-limit.y, next.y)),
    };
  };

  const updateLargeDiagramHint = () => {
    if (!largeDiagramHint) return;
    const fontSize = getFontSize?.() ?? 0;
    const hasContent = Boolean(contentSize());
    largeDiagramHint.hidden = !(hasContent && fontSize > 0 && fontSize * scale < MIN_READABLE_FONT_PX);
  };

  const applyTransform = () => {
    if (layer) {
      layer.style.setProperty('--preview-scale', String(scale));
      layer.style.setProperty('--preview-pan-x', `${pan.x}px`);
      layer.style.setProperty('--preview-pan-y', `${pan.y}px`);
    }
    if (zoom) zoom.textContent = `${Math.round(scale * 100)}%`;
    updateLargeDiagramHint();
  };

  /** Size the SVG explicitly to its intrinsic size (on the host, so exports are untouched). */
  const syncIntrinsicSize = (content: Size | undefined) => {
    const host = getSvg()?.parentElement;
    if (!host) return;
    if (content) {
      host.style.setProperty('--diagram-intrinsic-width', `${content.width}px`);
      host.style.setProperty('--diagram-intrinsic-height', `${content.height}px`);
    } else {
      host.style.removeProperty('--diagram-intrinsic-width');
      host.style.removeProperty('--diagram-intrinsic-height');
    }
  };

  const fit = () => {
    const content = contentSize();
    syncIntrinsicSize(content);
    const size = viewportSize();
    if (size.width <= 0 || size.height <= 0) {
      // Hidden or not laid out yet: refit once the viewport has a size.
      fitPending = true;
      return;
    }
    fitPending = false;
    scale = content ? computeFitScale(content, size) : 1;
    pan = { x: 0, y: 0 };
    fitted = true;
    applyTransform();
  };

  const setScale = (nextScale: number, anchor: Point = { x: 0, y: 0 }) => {
    const next = clampScale(nextScale, MANUAL_MAX_SCALE, scale);
    const nextPan = zoomAt(anchor, scale, next, pan);
    scale = next;
    pan = clampPan(nextPan);
    fitted = false;
    applyTransform();
  };

  const panTo = (next: Point) => {
    pan = clampPan(next);
    fitted = false;
    applyTransform();
  };

  const resetToActualSize = () => {
    scale = 1;
    pan = { x: 0, y: 0 };
    fitted = false;
    applyTransform();
  };

  const setGesturing = (active: boolean) => {
    viewport?.classList.toggle('is-dragging', active);
    layer?.classList.toggle('is-dragging', active);
  };

  const pinchState = (): { distance: number; mid: Point } | undefined => {
    const [a, b] = [...touches.values()];
    if (!a || !b) return undefined;
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      mid: toCenter((a.x + b.x) / 2, (a.y + b.y) / 2),
    };
  };

  viewport?.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') {
      // One finger is left to the browser (touch-action: pan-y); two fingers pinch and pan the diagram.
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.size === 2) {
        pinch = pinchState();
        for (const id of touches.keys()) {
          if (!viewport.hasPointerCapture(id)) viewport.setPointerCapture(id);
        }
        setGesturing(true);
      }
      return;
    }
    if (event.button !== 0) return;
    drag = { id: event.pointerId, start: { x: event.clientX, y: event.clientY }, pan: { ...pan } };
    viewport.setPointerCapture(event.pointerId);
    setGesturing(true);
  });

  viewport?.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') {
      if (!touches.has(event.pointerId)) return;
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.size !== 2 || !pinch) return;
      event.preventDefault();
      const next = pinchState();
      if (!next || pinch.distance <= 0) return;
      const ratio = next.distance / pinch.distance;
      // Zoom around the previous midpoint, then follow the midpoint's movement (two-finger pan).
      setScale(scale * ratio, pinch.mid);
      panTo({ x: pan.x + next.mid.x - pinch.mid.x, y: pan.y + next.mid.y - pinch.mid.y });
      pinch = next;
      return;
    }
    if (!drag || drag.id !== event.pointerId) return;
    event.preventDefault();
    panTo({ x: drag.pan.x + event.clientX - drag.start.x, y: drag.pan.y + event.clientY - drag.start.y });
  });

  const endPointer = (event: PointerEvent) => {
    if (touches.delete(event.pointerId)) {
      // Re-anchor on the remaining finger set so lifting one finger never makes the view jump.
      pinch = touches.size === 2 ? pinchState() : undefined;
      if (touches.size < 2) setGesturing(false);
      return;
    }
    if (drag && drag.id === event.pointerId) {
      drag = undefined;
      setGesturing(false);
    }
  };
  viewport?.addEventListener('pointerup', endPointer);
  viewport?.addEventListener('pointercancel', endPointer);
  viewport?.addEventListener('lostpointercapture', endPointer);

  viewport?.addEventListener('wheel', (event) => {
    // Without a modifier the wheel belongs to the page. ctrlKey also covers trackpad pinch on macOS/Windows.
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const deltaY = event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? event.deltaY * LINE_HEIGHT_PX
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? event.deltaY * viewportSize().height : event.deltaY;
    setScale(scale * wheelZoomFactor(deltaY), toCenter(event.clientX, event.clientY));
  }, { passive: false });

  actions.forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.previewAction;
      if (action === 'zoom-in') setScale(scale * ZOOM_STEP);
      if (action === 'zoom-out') setScale(scale / ZOOM_STEP);
      if (action === 'fit') fit();
    });
  });

  viewport?.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const step = event.shiftKey ? PAN_STEP_LARGE : PAN_STEP;
    const keyActions: Record<string, () => void> = {
      '+': () => setScale(scale * ZOOM_STEP),
      '=': () => setScale(scale * ZOOM_STEP),
      '-': () => setScale(scale / ZOOM_STEP),
      '0': resetToActualSize,
      Home: fit,
      ArrowLeft: () => panTo({ x: pan.x - step, y: pan.y }),
      ArrowRight: () => panTo({ x: pan.x + step, y: pan.y }),
      ArrowUp: () => panTo({ x: pan.x, y: pan.y - step }),
      ArrowDown: () => panTo({ x: pan.x, y: pan.y + step }),
    };
    const run = keyActions[event.key];
    if (!run) return;
    event.preventDefault();
    run();
  });

  // A new SVG (any re-render) gets its own intrinsic size and the pan is re-clamped to it, even without a refit.
  if (layer && typeof MutationObserver !== 'undefined') {
    new MutationObserver(() => {
      syncIntrinsicSize(contentSize());
      pan = clampPan(pan);
      applyTransform();
    }).observe(layer, { childList: true, subtree: true });
  }

  if (viewport && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      if (fitPending || fitted) fit();
    }).observe(viewport);
  }

  applyTransform();
  return { fit };
};
