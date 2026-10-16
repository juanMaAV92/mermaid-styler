import { describe, expect, it } from 'vitest';
import { formatMessage } from '../../src/i18n/format';
import { formatRenderError, type ErrorMessages } from '../../src/lib/mermaid/format-error';
import { MermaidRenderError } from '../../src/lib/mermaid/types';

const messages: ErrorMessages = {
  stateInvalid: 'Invalid Mermaid',
  stateTimeout: 'Timed out',
  timeoutStateHint: 'Simplify the source and try again.',
  errorFallback: 'Mermaid could not render this source.',
  syntaxErrorOnLine: 'Syntax error on line {line}',
};

describe('formatMessage', () => {
  it('substitutes placeholders and leaves unknown ones', () => {
    expect(formatMessage('Go to line {line}', { line: 4 })).toBe('Go to line 4');
    expect(formatMessage('{a} {b}', { a: 'x' })).toBe('x {b}');
  });
});

describe('formatRenderError', () => {
  it('AUD-018: extracts line and trims detail to 3 lines', () => {
    const details = 'Error: Parse error on line 2:\n...B[\n------^\n\nExpecting X, got Y';
    const result = formatRenderError(new MermaidRenderError('PARSE_ERROR', 'Mermaid could not parse this source.', details), messages);
    expect(result.line).toBe(2);
    expect(result.title).toBe('Syntax error on line 2');
    expect(result.detail.split('\n')).toHaveLength(3);
    expect(result.detail).not.toContain('Expecting');
  });

  it('clamps a reported line beyond the end of the source', () => {
    const err = new MermaidRenderError('PARSE_ERROR', 'm', 'Parse error on line 3:\nx');
    expect(formatRenderError(err, messages, 2)).toMatchObject({ line: 2, title: 'Syntax error on line 2' });
  });

  it('uses the error message for limits', () => {
    const result = formatRenderError(new MermaidRenderError('SOURCE_TOO_COMPLEX', 'too many connections (500 maximum)'), messages);
    expect(result.detail).toContain('500');
    expect(result.line).toBeUndefined();
    expect(result.title).toBe('Invalid Mermaid');
  });

  it('keeps the timeout hint', () => {
    const result = formatRenderError(new MermaidRenderError('RENDER_TIMEOUT', 'slow'), messages);
    expect(result).toEqual({ title: 'Timed out', detail: messages.timeoutStateHint });
  });

  it('falls back for parse errors without line and for unknown errors', () => {
    expect(formatRenderError(new MermaidRenderError('PARSE_ERROR', 'm', 'boom'), messages)).toEqual({ title: 'Invalid Mermaid', detail: 'boom' });
    expect(formatRenderError(new Error('x'), messages).detail).toBe(messages.errorFallback);
  });
});
