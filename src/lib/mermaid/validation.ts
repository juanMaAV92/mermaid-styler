import { MermaidRenderError } from './types';

export const DEFAULT_MAX_SOURCE_LENGTH = 50_000;
export const DEFAULT_MAX_SOURCE_LINES = 2_000;
export const MAX_EDGES = 500;
export const DEFAULT_RENDER_TIMEOUT_MS = 8_000;

// Longer operators first so each edge yields exactly one match.
const connectionPattern = /(?:<-->|-->>|-->|==>|-\.->|-\.-|->>|<--|--o|--x|---|~~~)/g;

export const countConnections = (source: string): number => source.match(connectionPattern)?.length ?? 0;

// AUD-013: flowchart `@{ img: … }` node metadata becomes an image-shape node, and Mermaid loads that image with
// `new Image()` while rendering, before any sanitizer runs (even when the render then fails). Reject it up front.
const SHAPE_DATA_OPEN = /@\s*\{/g;
// Over-inclusive on purpose: case is ignored and quotes are masked, so `"img"`, `'IMG'` and `? img :` all match.
const IMG_KEY = /(?:^|[\s{,?])img\s*:/i;

/** Shape data ends at the first `}` outside double quotes, as in Mermaid's flowchart lexer (rest of source if unclosed). */
const shapeDataEnd = (source: string, start: number): number => {
  let inString = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') inString = !inString;
    else if (char === '}' && !inString) return index;
  }
  return source.length;
};

/** YAML double-quoted escapes that could spell a key: `\x69`, `\u0069`, `\U00000069` and escaped line breaks. */
const decodeYamlEscapes = (text: string): string => text
  .replace(/\\\r?\n[ \t]*/g, '')
  .replace(/\\x([0-9a-fA-F]{2})|\\u([0-9a-fA-F]{4})|\\U([0-9a-fA-F]{8})/g, (_match, x?: string, u?: string, U?: string) => {
    const codePoint = Number.parseInt(x ?? u ?? U ?? '', 16);
    return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : '\ufffd';
  });

const lineAt = (source: string, index: number): number => source.slice(0, index).split('\n').length;

/** Quotes become spaces (offsets kept), so `"img"`, `'img'` and `img` are matched alike. */
const maskQuotes = (text: string): string => text.replace(/["']/g, ' ');

/** 1-based line of the first `@{…}` node metadata with an `img` key, or undefined if there is none. */
export const findImageMetadataLine = (source: string): number | undefined => {
  // Blocks never overlap: resume after each one so the scan stays linear (no rescan per unclosed `@{`).
  const opener = new RegExp(SHAPE_DATA_OPEN.source, 'g');
  for (let open = opener.exec(source); open; open = opener.exec(source)) {
    const start = open.index + open[0].length;
    const end = shapeDataEnd(source, start);
    opener.lastIndex = end;
    const block = source.slice(start, end);
    const plain = IMG_KEY.exec(maskQuotes(block));
    if (plain) return lineAt(source, start + plain.index + plain[0].search(/img/i));
    // An escaped key (e.g. `"\x69mg"`) changes offsets once decoded: report the line of the `@{` opener.
    if (IMG_KEY.test(maskQuotes(decodeYamlEscapes(block)))) return lineAt(source, open.index);
  }
  return undefined;
};

export const validateSource = (source: string, maxSourceLength = DEFAULT_MAX_SOURCE_LENGTH): string => {
  if (!source.trim()) {
    throw new MermaidRenderError('EMPTY_SOURCE', 'Paste a Mermaid definition to render.');
  }

  if (source.length > maxSourceLength) {
    throw new MermaidRenderError(
      'SOURCE_TOO_LARGE',
      `The Mermaid source must be ${maxSourceLength.toLocaleString()} characters or fewer.`,
    );
  }

  const sourceLines = source.split(/\r?\n/).filter((line) => line.trim()).length;
  if (sourceLines > DEFAULT_MAX_SOURCE_LINES) {
    throw new MermaidRenderError(
      'SOURCE_TOO_COMPLEX',
      `The Mermaid source has too many lines to render safely (${DEFAULT_MAX_SOURCE_LINES.toLocaleString()} maximum).`,
    );
  }

  const connections = countConnections(source);
  if (connections > MAX_EDGES) {
    throw new MermaidRenderError(
      'SOURCE_TOO_COMPLEX',
      `The Mermaid source has too many connections to render safely (${MAX_EDGES.toLocaleString()} maximum).`,
    );
  }

  const imageLine = findImageMetadataLine(source);
  if (imageLine !== undefined) {
    throw new MermaidRenderError('UNSAFE_SOURCE', 'Node metadata cannot load images.', `line ${imageLine}`);
  }

  return source;
};
