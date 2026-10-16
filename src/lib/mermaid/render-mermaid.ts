import mermaid, { type MermaidConfig } from 'mermaid';
import { pickSourceThemeVariables } from './directives';
import { sanitizeSvgElement } from './sanitize-svg';
import { DEFAULT_MAX_SOURCE_LENGTH, DEFAULT_RENDER_TIMEOUT_MS, MAX_EDGES, validateSource } from './validation';
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
  container.setAttribute('aria-hidden', 'true');
  container.dataset.mermaidTemporary = 'true';
  // Mermaid measures foreignObject labels during render. `display: none` makes
  // those measurements zero, so keep the node laid out but outside the viewport.
  Object.assign(container.style, {
    position: 'absolute',
    left: '-100000px',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
  });
  document.body.appendChild(container);
  return container;
};

export const MERMAID_SECURE_KEYS = [
  'secure',
  'securityLevel',
  'startOnLoad',
  'maxTextSize',
  'suppressErrorRendering',
  'maxEdges',
  'themeCSS',
  'fontFamily',
  'altFontFamily',
  'dompurifyConfig',
] as const;

/**
 * AUD-013: DOMPurify config for HTML labels. In `securityLevel: 'strict'` Mermaid's `sanitizeText` passes every label
 * through `DOMPurify.sanitize(text, config.dompurifyConfig)` (defaulting to `{ FORBID_TAGS: ['style'] }`), and the
 * result is laid out in the live temporary container before `sanitizeSvgElement` runs. DOMPurify's defaults keep
 * `<img src>` and `style`, so the browser would fetch label images and `url()` backgrounds during layout. Forbid every
 * tag and attribute that can load a resource; text formatting (`<b>`, `<i>`, `<br>`, markdown) is unaffected.
 */
export const LABEL_DOMPURIFY_CONFIG = {
  FORBID_TAGS: [
    'style', 'img', 'image', 'svg', 'math', 'iframe', 'object', 'embed', 'link', 'video', 'audio', 'source', 'picture',
    // `<input type="image" src>` also fetches during layout; no allowed label tag needs `src` or `poster`.
    'input',
  ],
  FORBID_ATTR: ['style', 'srcset', 'background', 'src', 'poster'],
} as const satisfies NonNullable<MermaidConfig['dompurifyConfig']>;

/** D1: keys added to `secure` unless the author opts into the source theme. `themeCSS` is always in the base list. */
export const MERMAID_SOURCE_THEME_KEYS = ['theme', 'themeVariables'] as const;

/** Per-diagram config keys of Mermaid 11 whose block accepts `useMaxWidth`. */
type DiagramConfigKey = {
  // `0 extends 1 & T` detects `any` (e.g. themeVariables), which would otherwise match every key.
  [K in keyof MermaidConfig]-?: 0 extends 1 & MermaidConfig[K]
    ? never
    : 'useMaxWidth' extends keyof NonNullable<MermaidConfig[K]> ? K : never;
}[keyof MermaidConfig];

/**
 * Every per-diagram block, so `useMaxWidth: false` applies to all diagram types: the SVG then keeps its
 * intrinsic size (100% zoom = real size) and the preview fits it itself. The type check below fails the
 * build if a Mermaid upgrade adds a diagram block missing from this list.
 */
export const MERMAID_DIAGRAM_CONFIG_KEYS = [
  'flowchart', 'swimlane', 'sequence', 'gantt', 'journey', 'timeline', 'class', 'state', 'er', 'pie',
  'quadrantChart', 'xyChart', 'requirement', 'architecture', 'mindmap', 'ishikawa', 'kanban', 'gitGraph',
  'c4', 'sankey', 'packet', 'block', 'eventmodeling', 'treeView', 'radar', 'venn', 'wardley-beta',
  'cynefin', 'railroad',
] as const satisfies readonly DiagramConfigKey[];

type MissingDiagramConfigKey = Exclude<DiagramConfigKey, (typeof MERMAID_DIAGRAM_CONFIG_KEYS)[number]>;
const diagramConfigKeysAreExhaustive: [MissingDiagramConfigKey] extends [never] ? true : MissingDiagramConfigKey = true;
void diagramConfigKeysAreExhaustive;

const intrinsicSizeConfig = Object.fromEntries(
  MERMAID_DIAGRAM_CONFIG_KEYS.map((key) => [key, { useMaxWidth: false }]),
) as Pick<MermaidConfig, (typeof MERMAID_DIAGRAM_CONFIG_KEYS)[number]>;

/**
 * Mermaid keeps the last diagram's directives at module level and replays them on `initialize`; a directive whose
 * colour khroma rejects would then fail every later render. Clear them first, and surface any throw as a render error.
 */
const initializeMermaid = (config: MermaidConfig) => {
  try {
    mermaid.mermaidAPI.reset();
    mermaid.initialize(config);
  } catch (error) {
    mermaid.mermaidAPI.reset();
    throw new MermaidRenderError('RENDER_ERROR', 'Mermaid could not apply this theme.', String(error));
  }
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
    const themeVariables: Record<string, string> = {
      background: options.theme.transparent ? 'transparent' : options.theme.background,
      primaryColor: options.theme.primaryColor,
      primaryBorderColor: options.theme.primaryBorderColor,
      primaryTextColor: options.theme.primaryTextColor,
      lineColor: options.theme.lineColor,
      secondaryColor: options.theme.accentColor,
      tertiaryColor: options.theme.background,
      fontFamily: options.theme.fontFamily,
      fontSize: `${options.theme.fontSize}px`,
    };
    const config: MermaidConfig = {
      startOnLoad: false,
      securityLevel: 'strict',
      // Mermaid deletes these keys from both `%%{init}%%` directives and frontmatter `config:` (one merged object).
      secure: options.allowSourceTheme
        ? [...MERMAID_SECURE_KEYS]
        : [...MERMAID_SECURE_KEYS, ...MERMAID_SOURCE_THEME_KEYS],
      theme: 'base',
      maxTextSize: maxSourceLength,
      maxEdges: MAX_EDGES,
      // Mermaid mutates nothing here, but hand it fresh arrays so the exported constant cannot be altered.
      dompurifyConfig: {
        FORBID_TAGS: [...LABEL_DOMPURIFY_CONFIG.FORBID_TAGS],
        FORBID_ATTR: [...LABEL_DOMPURIFY_CONFIG.FORBID_ATTR],
      },
      ...intrinsicSizeConfig,
      themeVariables,
    };
    initializeMermaid(config);

    let parsed: { diagramType?: string; config?: MermaidConfig };
    try {
      parsed = await withTimeout(mermaid.parse(validatedSource), timeoutMs);
    } catch (error) {
      if (error instanceof MermaidRenderError) throw error;
      throw new MermaidRenderError('PARSE_ERROR', 'Mermaid could not parse this source.', String(error));
    }

    // Mermaid only re-derives dependent colors (e.g. node fill from primaryColor) when a directive also sets
    // `theme`. With the source theme allowed, fold its sanitized themeVariables into the base derivation.
    // Only allowlisted colour values (and a numeric fontSize) are re-fed; see pickSourceThemeVariables. Mermaid
    // itself still merges the raw directive themeVariables (filtered only by its sanitizeDirective regex).
    const sourceOverrides = options.allowSourceTheme && !parsed.config?.theme
      ? pickSourceThemeVariables(parsed.config?.themeVariables)
      : {};
    if (Object.keys(sourceOverrides).length > 0) {
      initializeMermaid({ ...config, themeVariables: { ...themeVariables, ...sourceOverrides } });
    }

    try {
      const result = await withTimeout(mermaid.render(renderId, validatedSource, container), timeoutMs);
      const report = { droppedStyle: false };
      const element = sanitizeSvgElement(result.svg, report);
      return {
        svg: new XMLSerializer().serializeToString(element),
        element,
        diagramType: result.diagramType ?? parsed.diagramType ?? 'unknown',
        droppedStyle: report.droppedStyle,
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
