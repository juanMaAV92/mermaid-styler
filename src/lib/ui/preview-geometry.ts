export type Size = { width: number; height: number };
export type Point = { x: number; y: number };

export const FIT_PADDING_RATIO = 0.9;
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 2;
export const PAN_MARGIN = 48;
export const WHEEL_ZOOM_SENSITIVITY = 0.002;

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function isPositiveFinite(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

export function computeFitScale(content: Size, viewport: Size): number {
  if (!isPositiveFinite(content.width) || !isPositiveFinite(content.height)) return 1;
  const raw =
    Math.min(viewport.width / content.width, viewport.height / content.height) * FIT_PADDING_RATIO;
  return Number.isFinite(raw) ? clampScale(raw) : 1;
}

export function computePanLimit(content: Size, viewport: Size, scale: number): Point {
  return {
    x: Math.max(0, (content.width * scale - viewport.width) / 2) + PAN_MARGIN,
    y: Math.max(0, (content.height * scale - viewport.height) / 2) + PAN_MARGIN,
  };
}

export function wheelZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY);
}

/** `point` is relative to the viewport center (layer uses transform-origin: center). */
export function zoomAt(point: Point, scale: number, nextScale: number, pan: Point): Point {
  const ratio = nextScale / scale;
  return {
    x: point.x - (point.x - pan.x) * ratio,
    y: point.y - (point.y - pan.y) * ratio,
  };
}
