import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_CONNECTIONS,
  DEFAULT_MAX_SOURCE_LINES,
  validateSource,
} from '../../src/lib/mermaid/validation';
import { MermaidRenderError } from '../../src/lib/mermaid/types';

describe('Mermaid source validation', () => {
  it('rejects empty source with an actionable error code', () => {
    expect(() => validateSource('  \n')).toThrowError(MermaidRenderError);
    expect(() => validateSource('  \n')).toThrowError(expect.objectContaining({ code: 'EMPTY_SOURCE' }));
  });

  it('rejects source over the configured limit', () => {
    expect(() => validateSource('12345', 4)).toThrowError(expect.objectContaining({ code: 'SOURCE_TOO_LARGE' }));
  });

  it('returns valid source unchanged', () => {
    const source = 'flowchart LR\n  A --> B';
    expect(validateSource(source)).toBe(source);
  });

  it('rejects sources with excessive line or connection complexity', () => {
    const manyLines = Array.from({ length: DEFAULT_MAX_SOURCE_LINES + 1 }, (_, index) => `A${index}`).join('\n');
    const manyConnections = `flowchart LR\n${'A --> B\n'.repeat(DEFAULT_MAX_CONNECTIONS + 1)}`;

    expect(() => validateSource(manyLines)).toThrowError(expect.objectContaining({ code: 'SOURCE_TOO_COMPLEX' }));
    expect(() => validateSource(manyConnections)).toThrowError(expect.objectContaining({ code: 'SOURCE_TOO_COMPLEX' }));
  });
});
