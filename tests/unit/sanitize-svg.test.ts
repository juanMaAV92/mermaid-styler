import { describe, expect, it } from 'vitest';
import {
  hasExternalCssReference, normalizeVoidElements, sanitizeSvg, sanitizeSvgElement,
} from '../../src/lib/mermaid/sanitize-svg';

describe('SVG sanitization rules', () => {
  it.each([
    ['url(https://example.com/asset.svg)', true],
    ['url("data:image/svg+xml;base64,PHN2Zy8+")', true],
    ['fill: url(#local-gradient)', false],
    ['stroke: none', false],
  ])('identifies external CSS URL references: %s', (value, expected) => {
    expect(hasExternalCssReference(value)).toBe(expected);
  });

  it.each([
    ['@import "https://x/y.css";', true],
    ['fill: image-set("https://x/a.png" 1x)', true],
    ['src("https://x/f.woff")', true],
    ['fill: url(#grad)', false],
    ['\\75 rl(https://x)', true],
    ['u\\72l(https://x)', true],
    ['@\\69mport "x"', true],
    ['URL(https://x)', true],
    ['-webkit-image-set("https://x" 1x)', true],
    ['@import url(x)', true],
    ['a{x:"/*";background-image:url(https://evil.example/a.png);y:"*/"}', true],
    ['a{x:\\/*;background-image:url(https://evil.example/a.png);y:*/}', true],
    ['stroke: none', false],
  ])('AUD-013: detects external CSS references: %s', (value, expected) => {
    expect(hasExternalCssReference(value)).toBe(expected);
  });

  it('normalizes Mermaid HTML line breaks without changing self-closing tags', () => {
    expect(normalizeVoidElements('<svg><br><br class="label"/><BR data-line="2"></svg>'))
      .toBe('<svg><br/><br class="label"/><br data-line="2"/></svg>');
  });

  it('AUD-017: normalizes all void elements', () => {
    expect(normalizeVoidElements('<svg><hr><img src="x"><br/></svg>'))
      .toBe('<svg><hr/><img src="x"/><br/></svg>');
  });

  it.each([
    ['<area><base><col><embed><input><link><meta><source><track><wbr>', '<area/><base/><col/><embed/><input/><link/><meta/><source/><track/><wbr/>'],
    ['<img alt="a>b">', '<img alt="a>b"/>'],
    ["<img alt='a>b' src=\"x\">", "<img alt='a>b' src=\"x\"/>"],
    ['<IMG SRC="x"><Hr>', '<img SRC="x"/><hr/>'],
    ['<img src="x" />', '<img src="x" />'],
    ['<header><colgroup></colgroup></header>', '<header><colgroup></colgroup></header>'],
    ['<image href="#x"/><linkx><imgx>', '<image href="#x"/><linkx><imgx>'],
    ['</br><br\n class="a">', '</br><br\n class="a"/>'],
  ])('AUD-017: normalizeVoidElements(%s)', (input, expected) => {
    expect(normalizeVoidElements(input)).toBe(expected);
  });

  it('AUD-017: label with unclosed img sanitizes without error', () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="100" height="30">'
      + '<div xmlns="http://www.w3.org/1999/xhtml"><b>bold</b> <img src="x"></div></foreignObject></svg>';
    let output = '';
    expect(() => { output = sanitizeSvg(source); }).not.toThrow();
    expect(output).not.toContain('<img');
    expect(output).toContain('bold');
  });

  it('AUD-015: removes animate/set that can rewrite href', () => {
    const output = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><a>'
      + '<animate attributeName="href" values="javascript:alert(1)"/>'
      + '<animateMotion dur="1s"/><animateTransform attributeName="transform"/>'
      + '<set attributeName="href" to="javascript:alert(1)"/><text>kept</text></a></svg>',
    );
    expect(output).not.toMatch(/<animate|<set/i);
    expect(output).not.toContain('javascript:');
    expect(output).toContain('kept');
  });

  it('AUD-015: sanitizeSvgElement returns an SVGSVGElement', () => {
    const element = sanitizeSvgElement('<svg xmlns="http://www.w3.org/2000/svg"><text>hi</text></svg>');
    expect(element.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(element.localName).toBe('svg');
    expect(element.textContent).toBe('hi');
    const imported = document.importNode(element, true);
    expect(imported.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  it('AUD-017: invalid XML still throws SANITIZE_ERROR', () => {
    expect(() => sanitizeSvgElement('<svg xmlns="http://www.w3.org/2000/svg"><g></svg>'))
      .toThrow(expect.objectContaining({ code: 'SANITIZE_ERROR' }));
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
