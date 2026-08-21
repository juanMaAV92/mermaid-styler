import { MermaidRenderError } from './types';

export const DEFAULT_MAX_SOURCE_LENGTH = 100_000;
export const DEFAULT_RENDER_TIMEOUT_MS = 8_000;

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

  return source;
};
