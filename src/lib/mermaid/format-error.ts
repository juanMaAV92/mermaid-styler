import { formatMessage } from '../../i18n/format';
import { MermaidRenderError } from './types';

export type ErrorMessages = {
  stateInvalid: string;
  stateTimeout: string;
  timeoutStateHint: string;
  errorFallback: string;
  syntaxErrorOnLine: string;
};

export type FormattedRenderError = { title: string; detail: string; line?: number };

const MAX_DETAIL_LINES = 3;

export const formatRenderError = (error: unknown, messages: ErrorMessages, sourceLineCount?: number): FormattedRenderError => {
  if (!(error instanceof MermaidRenderError)) {
    return { title: messages.stateInvalid, detail: messages.errorFallback };
  }

  if (error.code === 'RENDER_TIMEOUT') {
    return { title: messages.stateTimeout, detail: messages.timeoutStateHint };
  }

  if (error.code === 'PARSE_ERROR' || error.code === 'RENDER_ERROR') {
    const lines = (error.details ?? '')
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .slice(0, MAX_DETAIL_LINES);
    if (lines.length === 0) return { title: messages.stateInvalid, detail: error.message };

    const match = /line (\d+)/i.exec(error.details ?? '');
    // Mermaid's lexer can report a line past the end of the source (e.g. unterminated token at EOF).
    const reported = match ? Number(match[1]) : undefined;
    const line = reported && sourceLineCount ? Math.min(reported, sourceLineCount) : reported;
    return {
      title: line ? formatMessage(messages.syntaxErrorOnLine, { line }) : messages.stateInvalid,
      detail: lines.join('\n'),
      ...(line ? { line } : {}),
    };
  }

  return { title: messages.stateInvalid, detail: error.message };
};
