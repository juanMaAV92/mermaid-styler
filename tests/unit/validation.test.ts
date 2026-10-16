import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_SOURCE_LINES,
  MAX_EDGES,
  countConnections,
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
    const manyConnections = `flowchart LR\n${'A --> B\n'.repeat(MAX_EDGES + 1)}`;

    expect(() => validateSource(manyLines)).toThrowError(expect.objectContaining({ code: 'SOURCE_TOO_COMPLEX' }));
    expect(() => validateSource(manyConnections)).toThrowError(expect.objectContaining({ code: 'SOURCE_TOO_COMPLEX' }));
  });

  it('AUD-016: validator edge limit matches Mermaid maxEdges', () => {
    expect(MAX_EDGES).toBe(500);
    const make = (n: number) => `flowchart LR\n${'A --> B\n'.repeat(n)}`;
    expect(() => validateSource(make(501))).toThrowError(
      expect.objectContaining({ code: 'SOURCE_TOO_COMPLEX', message: expect.stringContaining('500') }),
    );
    expect(() => validateSource(make(500))).not.toThrow();
  });

  it.each([
    ['-->', 'A --> B'],
    ['==>', 'A ==> B'],
    ['-.->', 'A -.-> B'],
    ['-->>', 'A -->> B'],
    ['->>', 'A ->> B'],
    ['<-->', 'A <--> B'],
    ['<--', 'A <-- B'],
    ['---', 'A --- B'],
    ['--o', 'A --o B'],
    ['--x', 'A --x B'],
    ['-.-', 'A -.- B'],
    ['~~~', 'A ~~~ B'],
  ])('AUD-016: counts exactly one edge for operator %s', (_op, line) => {
    expect(countConnections(line)).toBe(1);
    expect(countConnections(`${line}\n${line}`)).toBe(2);
  });
});
