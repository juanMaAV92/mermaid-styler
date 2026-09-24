import { MermaidRenderError } from './types';

export const DEFAULT_MAX_SOURCE_LENGTH = 50_000;
export const DEFAULT_MAX_SOURCE_LINES = 2_000;
export const DEFAULT_MAX_CONNECTIONS = 1_200;
export const DEFAULT_RENDER_TIMEOUT_MS = 8_000;

const connectionPattern = /(?:-->|==>|-.->|-->>|->>|<-->|<--|---)/g;

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

  const connections = source.match(connectionPattern)?.length ?? 0;
  if (connections > DEFAULT_MAX_CONNECTIONS) {
    throw new MermaidRenderError(
      'SOURCE_TOO_COMPLEX',
      `The Mermaid source has too many connections to render safely (${DEFAULT_MAX_CONNECTIONS.toLocaleString()} maximum).`,
    );
  }

  return source;
};
