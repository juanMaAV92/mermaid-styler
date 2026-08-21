import mermaid from 'mermaid';
import { sanitizeSvg } from './sanitize-svg';
import { DEFAULT_MAX_SOURCE_LENGTH, DEFAULT_RENDER_TIMEOUT_MS, validateSource } from './validation';
import { MermaidRenderError, type MermaidRenderResult, type RenderMermaidOptions } from './types';

let renderSequence = 0;

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new MermaidRenderError('RENDER_TIMEOUT', 'Mermaid took too long to render.'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const temporaryContainer = (): HTMLDivElement => {
  const container = document.createElement('div');
  container.hidden = true;
  container.setAttribute('aria-hidden', 'true');
  container.dataset.mermaidTemporary = 'true';
  document.body.appendChild(container);
  return container;
};

export const renderMermaid = async (
  source: string,
  options: RenderMermaidOptions,
): Promise<MermaidRenderResult> => {
  const maxSourceLength = options.maxSourceLength ?? DEFAULT_MAX_SOURCE_LENGTH;
  const timeoutMs = options.timeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS;
  const validatedSource = validateSource(source, maxSourceLength);
  const renderId = `mermaid-styler-${renderSequence += 1}`;
  const container = temporaryContainer();

  try {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      maxTextSize: maxSourceLength,
      themeVariables: {
        background: options.theme.transparent ? 'transparent' : options.theme.background,
        primaryColor: options.theme.primaryColor,
        primaryBorderColor: options.theme.primaryBorderColor,
        primaryTextColor: options.theme.primaryTextColor,
        lineColor: options.theme.lineColor,
        secondaryColor: options.theme.accentColor,
        tertiaryColor: options.theme.background,
        fontFamily: options.theme.fontFamily,
        fontSize: `${options.theme.fontSize}px`,
      },
    });

    let parsed: { diagramType?: string };
    try {
      parsed = await withTimeout(mermaid.parse(validatedSource), timeoutMs);
    } catch (error) {
      if (error instanceof MermaidRenderError) throw error;
      throw new MermaidRenderError('PARSE_ERROR', 'Mermaid could not parse this source.', String(error));
    }

    try {
      const result = await withTimeout(mermaid.render(renderId, validatedSource, container), timeoutMs);
      return {
        svg: sanitizeSvg(result.svg),
        diagramType: result.diagramType ?? parsed.diagramType ?? 'unknown',
        bindFunctions: result.bindFunctions,
      };
    } catch (error) {
      if (error instanceof MermaidRenderError) throw error;
      throw new MermaidRenderError('RENDER_ERROR', 'Mermaid could not render this source.', String(error));
    }
  } finally {
    container.remove();
  }
};
