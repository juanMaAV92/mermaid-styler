export type MermaidThemeOptions = {
  background: string;
  primaryColor: string;
  primaryBorderColor: string;
  primaryTextColor: string;
  lineColor: string;
  accentColor: string;
  fontFamily: string;
  fontSize: number;
  transparent: boolean;
};

export type RenderMermaidOptions = {
  theme: MermaidThemeOptions;
  maxSourceLength?: number;
  timeoutMs?: number;
};

export type RenderErrorCode =
  | 'EMPTY_SOURCE'
  | 'SOURCE_TOO_LARGE'
  | 'PARSE_ERROR'
  | 'RENDER_TIMEOUT'
  | 'RENDER_ERROR'
  | 'SANITIZE_ERROR';

export class MermaidRenderError extends Error {
  constructor(
    public readonly code: RenderErrorCode,
    message: string,
    public readonly details?: string,
  ) {
    super(message);
    this.name = 'MermaidRenderError';
  }
}

export type MermaidRenderResult = {
  svg: string;
  diagramType: string;
  bindFunctions?: (element: Element) => void;
};
