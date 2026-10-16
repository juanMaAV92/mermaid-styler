export type Size = { width: number; height: number };
export type Point = { x: number; y: number };

export const FIT_PADDING_RATIO = 0.9;
export const MIN_SCALE = 0.1;
/** Upper bound for Fit: small diagrams are enlarged at most 2× (D6). */
export const MAX_SCALE = 2;
/**
 * Upper bound for manual zoom (buttons, keyboard, ctrl+wheel, pinch). It is higher than the Fit cap so
 * authors can still inspect small labels in a diagram that Fit shrank, without Fit itself blowing up tiny diagrams.
 */
export const MANUAL_MAX_SCALE = 4;
/** Effective text size (px) below which a diagram counts as hard to read. */
export const MIN_READABLE_FONT_PX = 8;
/** Reference desktop viewport: a diagram is "large" only if it is unreadable even when fitted into this. */
export const LARGE_DIAGRAM_REFERENCE_VIEWPORT: Size = { width: 720, height: 480 };
/** Relative change in intrinsic width or height above which a re-render refits the preview. */
export const SIGNIFICANT_SIZE_CHANGE = 0.2;
export const PAN_MARGIN = 48;
export const WHEEL_ZOOM_SENSITIVITY = 0.002;

export function clampScale(scale: number, max: number = MAX_SCALE, fallback = 1): number {
  if (Number.isNaN(scale)) return fallback;
  return Math.min(max, Math.max(MIN_SCALE, scale));
}

function isPositiveFinite(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

/**
 * M3: usable bottom inset (px) reserved for floating controls. Invalid values, or an inset that would take half
 * the viewport or more, are ignored so a tiny viewport still gets a sensible fit.
 */
function usableInset(viewport: Size, bottomInset: number): number {
  return isPositiveFinite(bottomInset) && bottomInset < viewport.height / 2 ? bottomInset : 0;
}

/** Fit scale (D6); `bottomInset` px at the bottom of the viewport are kept free for the zoom controls (M3). */
export function computeFitScale(content: Size, viewport: Size, bottomInset = 0): number {
  if (!isPositiveFinite(content.width) || !isPositiveFinite(content.height)) return 1;
  const height = viewport.height - usableInset(viewport, bottomInset);
  const raw =
    Math.min(viewport.width / content.width, height / content.height) * FIT_PADDING_RATIO;
  return Number.isFinite(raw) ? clampScale(raw) : 1;
}

/** Pan after Fit: centre the diagram in the area above the bottom inset (M3). */
export function computeFitPan(viewport: Size, bottomInset = 0): Point {
  const inset = usableInset(viewport, bottomInset);
  return { x: 0, y: inset > 0 ? -inset / 2 : 0 };
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
  if (!isPositiveFinite(scale) || !isPositiveFinite(nextScale)) return pan;
  const ratio = nextScale / scale;
  return {
    x: point.x - (point.x - pan.x) * ratio,
    y: point.y - (point.y - pan.y) * ratio,
  };
}

const parseLength = (value: string | null): number | undefined => {
  if (!value || value.trim().endsWith('%')) return undefined;
  const parsed = Number.parseFloat(value);
  return isPositiveFinite(parsed) ? parsed : undefined;
};

/** Intrinsic SVG size: viewBox width/height first, then numeric width/height attributes (same precedence as PNG export). */
export function parseSvgIntrinsicSize(attrs: { viewBox: string | null; width: string | null; height: string | null }): Size | undefined {
  const box = attrs.viewBox?.trim().split(/[\s,]+/).map(Number) ?? [];
  if (box.length === 4 && isPositiveFinite(box[2]) && isPositiveFinite(box[3])) return { width: box[2], height: box[3] };
  const width = parseLength(attrs.width);
  const height = parseLength(attrs.height);
  return width && height ? { width, height } : undefined;
}

export function hasSignificantSizeChange(previous: Size | undefined, next: Size, threshold = SIGNIFICANT_SIZE_CHANGE): boolean {
  if (!previous || !isPositiveFinite(previous.width) || !isPositiveFinite(previous.height)) return true;
  return Math.abs(next.width - previous.width) / previous.width > threshold
    || Math.abs(next.height - previous.height) / previous.height > threshold;
}

/**
 * True when the text is unreadable at the current scale AND would still be unreadable fitted into a reference
 * desktop viewport (at least 720×480). A small diagram squeezed onto a phone, or manually zoomed out, is not "large".
 */
export function isLargeDiagram(content: Size, viewport: Size, scale: number, fontSize: number): boolean {
  if (!isPositiveFinite(fontSize) || !isPositiveFinite(scale)) return false;
  if (fontSize * scale >= MIN_READABLE_FONT_PX) return false;
  const reference = {
    width: Math.max(viewport.width, LARGE_DIAGRAM_REFERENCE_VIEWPORT.width),
    height: Math.max(viewport.height, LARGE_DIAGRAM_REFERENCE_VIEWPORT.height),
  };
  return fontSize * computeFitScale(content, reference) < MIN_READABLE_FONT_PX;
}
