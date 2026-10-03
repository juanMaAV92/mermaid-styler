// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { hasExternalCssUrl, normalizeMermaidLineBreaks, sanitizeSvg } from '../../src/lib/mermaid/sanitize-svg';

describe('SVG sanitization rules', () => {
  it.each([
    ['url(https://example.com/asset.svg)', true],
    ['url("data:image/svg+xml;base64,PHN2Zy8+")', true],
    ['fill: url(#local-gradient)', false],
    ['stroke: none', false],
  ])('identifies external CSS URL references: %s', (value, expected) => {
    expect(hasExternalCssUrl(value)).toBe(expected);
  });

  it('normalizes Mermaid HTML line breaks without changing self-closing tags', () => {
    expect(normalizeMermaidLineBreaks('<svg><br><br class="label"/><BR data-line="2"></svg>'))
      .toBe('<svg><br/><br class="label"/><br data-line="2"/></svg>');
  });

  it('removes active and external content while preserving safe Mermaid labels', () => {
    const sanitized = sanitizeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <rect fill="url(https://example.com/asset.svg)" onclick="alert(1)" />
        <path style="stroke: url(https://example.com/stroke.svg)" />
        <a href="https://example.com">external link</a>
        <use href="https://example.com/symbol.svg#node" />
        <script>alert(1)</script>
        <foreignObject width="100" height="30">
          <div xmlns="http://www.w3.org/1999/xhtml"><p onerror="alert(1)">Safe label</p><img src="https://example.com/asset.png" /></div>
        </foreignObject>
      </svg>
    `);

    expect(sanitized).not.toContain('https://example.com');
    expect(sanitized).not.toContain('onclick');
    expect(sanitized).not.toContain('onerror');
    expect(sanitized).not.toContain('<script');
    expect(sanitized).not.toContain('<use');
    expect(sanitized).not.toContain('<img');
    expect(sanitized).toContain('Safe label');
  });
});
