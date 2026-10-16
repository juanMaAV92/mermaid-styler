import { describe, expect, it } from 'vitest';
import { addSvgMetadata } from '../../src/lib/export/svg';

describe('addSvgMetadata', () => {
  it('throws instead of embedding a parser error', () => {
    const broken = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">a<br>b</div></foreignObject></svg>';
    expect(() => addSvgMetadata(broken, { title: 't', description: 'd' })).toThrow();
  });
});
