import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_SOURCE_LINES,
  MAX_EDGES,
  countConnections,
  findImageMetadataLine,
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

describe('image-shape node metadata (AUD-013)', () => {
  it.each([
    ['plain key', 'flowchart LR\n  A@{ img: "https://evil.example/a.png", label: "x" } --> B'],
    ['relative url', 'flowchart LR\n  A@{ img: "probe-shape.png" } --> B'],
    ['double-quoted key', 'flowchart LR\n  A@{ "img": "x.png" } --> B'],
    ['single-quoted key', "flowchart LR\n  A@{ 'img' : 'x.png' } --> B"],
    ['upper case', 'flowchart LR\n  A@{ IMG: "x.png" } --> B'],
    ['mixed case', 'flowchart LR\n  A@{ label: "x", Img : "x.png" } --> B'],
    ['whitespace before the brace', 'flowchart LR\n  A@ {img:"x.png"} --> B'],
    ['multi-line metadata', 'flowchart LR\n  A@{\n    label: "x",\n    img\t:\n      "x.png"\n  } --> B'],
    ['explicit YAML key', 'flowchart LR\n  A@{ ? img : "x.png" } --> B'],
    ['hex-escaped key', 'flowchart LR\n  A@{ "\\x69mg": "x.png" } --> B'],
    ['unicode-escaped key', 'flowchart LR\n  A@{ "\\u0069\\u006Dg": "x.png" } --> B'],
    ['escaped line break in key', 'flowchart LR\n  A@{ "i\\\n   mg": "x.png" } --> B'],
    ['second node of a chain', 'flowchart LR\n  A --> B@{ img: "x.png" }'],
  ])('AUD-013: rejects img in @{…} metadata (%s)', (_name, source) => {
    expect(() => validateSource(source)).toThrowError(expect.objectContaining({ code: 'UNSAFE_SOURCE' }));
  });

  it('AUD-013: reports the line of the offending metadata', () => {
    expect(findImageMetadataLine('flowchart LR\n  A --> B\n  C@{ img: "x.png" }')).toBe(3);
    expect(findImageMetadataLine('flowchart LR\n  A@{\n  label: "x",\n  img: "x.png"\n}')).toBe(4);
    expect(() => validateSource('flowchart LR\n  A --> B\n  C@{ img: "x.png" }'))
      .toThrowError(expect.objectContaining({ code: 'UNSAFE_SOURCE', details: 'line 3' }));
  });

  it.each([
    ['other metadata keys', 'flowchart LR\n  A@{ shape: rect, label: "Image of x" } --> B'],
    ['icon shape', 'flowchart LR\n  A@{ icon: "fa:user", form: "square", label: "x" } --> B'],
    ['img text outside metadata', 'flowchart LR\n  A["img: not metadata"] --> B'],
    ['img as a value', 'flowchart LR\n  A@{ label: "img" } --> B'],
    ['longer key', 'flowchart LR\n  A@{ imgs: "x" } --> B'],
  ])('AUD-013: allows %s', (_name, source) => {
    expect(validateSource(source)).toBe(source);
    expect(findImageMetadataLine(source)).toBeUndefined();
  });

  it('AUD-013: stays linear on many unclosed @{ openers', () => {
    const source = `flowchart LR\n  ${'A@{ label: "x" '.repeat(3_000)}`;
    const start = performance.now();
    expect(findImageMetadataLine(source)).toBeUndefined();
    expect(performance.now() - start).toBeLessThan(50);
  });
});
