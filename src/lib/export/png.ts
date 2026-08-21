export type PngExportOptions = {
  fontFamily: string;
  fontSize: string;
  textColor: string;
  background: string;
  transparent: boolean;
  scale?: number;
  maxPixels?: number;
};

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const DEFAULT_SCALE = 3;
const DEFAULT_MAX_PIXELS = 16_000_000;

const parseLength = (value: string | null) => {
  if (!value || value.trim().endsWith('%')) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const getDimensions = (svg: SVGSVGElement) => {
  const viewBox = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number) ?? [];
  const width = viewBox.length === 4 && Number.isFinite(viewBox[2]) ? viewBox[2] : parseLength(svg.getAttribute('width'));
  const height = viewBox.length === 4 && Number.isFinite(viewBox[3]) ? viewBox[3] : parseLength(svg.getAttribute('height'));
  const bounds = svg.getBoundingClientRect();
  const resolvedWidth = width ?? bounds.width;
  const resolvedHeight = height ?? bounds.height;

  return {
    width: resolvedWidth > 0 ? resolvedWidth : bounds.width,
    height: resolvedHeight > 0 ? resolvedHeight : bounds.height,
  };
};

const getCanvasSafeMarkup = (svg: SVGSVGElement, options: PngExportOptions) => {
  const clone = svg.cloneNode(true) as SVGSVGElement;

  clone.querySelectorAll('foreignObject').forEach((foreignObject) => {
    const paragraphs = [...foreignObject.querySelectorAll('p')]
      .map((paragraph) => paragraph.textContent?.trim() ?? '')
      .filter(Boolean);
    const lines = paragraphs.length > 0
      ? paragraphs
      : [foreignObject.textContent?.trim() ?? ''].filter(Boolean);

    if (lines.length === 0) {
      foreignObject.remove();
      return;
    }

    const width = Number.parseFloat(foreignObject.getAttribute('width') ?? '0') || 0;
    const height = Number.parseFloat(foreignObject.getAttribute('height') ?? '0') || 0;
    const x = Number.parseFloat(foreignObject.getAttribute('x') ?? '0') || 0;
    const y = Number.parseFloat(foreignObject.getAttribute('y') ?? '0') || 0;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const text = document.createElementNS(SVG_NAMESPACE, 'text');
    const lineHeight = 1.2;

    text.setAttribute('x', String(centerX));
    text.setAttribute('y', String(centerY));
    text.setAttribute('fill', options.textColor);
    text.setAttribute('font-family', options.fontFamily);
    text.setAttribute('font-size', options.fontSize);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');

    lines.forEach((line, index) => {
      const tspan = document.createElementNS(SVG_NAMESPACE, 'tspan');
      tspan.textContent = line;
      tspan.setAttribute('x', String(centerX));
      tspan.setAttribute('dy', `${(index - (lines.length - 1) / 2) * lineHeight}em`);
      text.appendChild(tspan);
    });

    foreignObject.replaceWith(text);
  });

  return clone.outerHTML;
};

export const svgToPngBlob = async (svg: SVGSVGElement, options: PngExportOptions): Promise<Blob> => {
  const sourceUrl = URL.createObjectURL(new Blob([getCanvasSafeMarkup(svg, options)], { type: 'image/svg+xml;charset=utf-8' }));
  const image = new Image();

  try {
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('The SVG could not be rasterized.'));
    });
    image.decoding = 'async';
    image.src = sourceUrl;
    await loaded;

    const dimensions = getDimensions(svg);
    if (!dimensions.width || !dimensions.height) throw new Error('The SVG has no usable dimensions.');

    const scale = options.scale ?? DEFAULT_SCALE;
    const maxPixels = options.maxPixels ?? DEFAULT_MAX_PIXELS;
    const requestedPixels = dimensions.width * dimensions.height * scale * scale;
    const boundedScale = Math.min(scale, Math.sqrt(maxPixels / requestedPixels));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(dimensions.width * boundedScale));
    canvas.height = Math.max(1, Math.ceil(dimensions.height * boundedScale));

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not available in this browser.');

    if (!options.transparent) {
      context.fillStyle = options.background;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('PNG encoding failed.'));
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
};
