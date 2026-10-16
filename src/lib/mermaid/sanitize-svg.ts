import DOMPurify from 'dompurify';
import { MermaidRenderError } from './types';

const isFragmentReference = (value: string) => value.trim().startsWith('#');

// CSS tokenizers decode escapes (`\75 rl(`) and drop comments. Decoys such as
// `x:"/*"` make comment stripping unreliable, so fail closed: flag the value
// if any of the raw, decoded, or decoded+comment-stripped forms matches.
const stripComments = (value: string): string => value.replace(/\/\*[\s\S]*?\*\//g, '');

const decodeEscapes = (value: string): string => value
  .replace(/\\([0-9a-fA-F]{1,6})\s?|\\([\s\S])/g, (_match, hex?: string, char?: string) => {
    if (char !== undefined) return char;
    const codePoint = Number.parseInt(hex ?? '', 16);
    return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : '\ufffd';
  });

const matchesExternalReference = (value: string): boolean => {
  const urls = [...value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)].map((match) => match[2].trim());
  if (urls.some((url) => url && !isFragmentReference(url))) return true;
  return /image-set\([^)]*['"]/i.test(value)
    || /@import\b/i.test(value)
    || /(?<![\w-])src\(/i.test(value);
};

export const hasExternalCssReference = (raw: string): boolean => {
  const decoded = decodeEscapes(raw);
  return [raw, decoded, stripComments(decoded)].some(matchesExternalReference);
};

// Mermaid renders HTML labels inside `foreignObject` and serializes them with
// HTML rules, so void elements (`<br>`, `<img>`, `<hr>`...) arrive unclosed and
// the SVG/XML parser used for sanitization would reject the document. Close
// them before parsing. The lookahead keeps longer names (`<header>`,
// `<image>`, `<colgroup>`) untouched and quoted attribute values may contain
// `>`. Anything this does not repair fails closed as SANITIZE_ERROR.
const VOID_ELEMENT_PATTERN = /<(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)(?=[\s/>])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;

export const normalizeVoidElements = (svg: string): string => svg.replace(
  VOID_ELEMENT_PATTERN,
  (match, tagName: string, attributes: string) => (
    /\/\s*$/.test(attributes) ? match : `<${tagName.toLowerCase()}${attributes}/>`
  ),
);

// SMIL animation elements can rewrite attributes (e.g. `href`) after
// sanitization, so they are removed together with other active content.
const REMOVED_ELEMENTS = [
  'script', 'iframe', 'object', 'embed', 'link', 'image', 'img', 'use',
  'animate', 'animateMotion', 'animateTransform', 'set',
].join(', ');

const invalidSvg = () => new MermaidRenderError('SANITIZE_ERROR', 'Mermaid returned an invalid SVG document.');

/** Filled in by `sanitizeSvgElement` so callers can tell the author what was removed (M2). */
export type SanitizeReport = { droppedStyle: boolean };

export const sanitizeSvgElement = (svg: string, report?: SanitizeReport): SVGSVGElement => {
  if (typeof DOMParser === 'undefined') throw invalidSvg();

  const document = new DOMParser().parseFromString(normalizeVoidElements(svg), 'image/svg+xml');
  const root = document.documentElement;

  if (!root || root.tagName.toLowerCase() !== 'svg' || document.querySelector('parsererror')) {
    throw invalidSvg();
  }

  document.querySelectorAll('foreignObject').forEach((foreignObject) => {
    const sanitizedLabel = DOMPurify.sanitize(foreignObject.innerHTML, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['style', 'svg', 'math', 'img', 'a', 'iframe', 'object', 'embed', 'link'],
    });
    const labelDocument = new DOMParser().parseFromString(sanitizedLabel, 'text/html');
    foreignObject.replaceChildren(...[...labelDocument.body.childNodes].map((node) => document.importNode(node, true)));
  });

  document.querySelectorAll(REMOVED_ELEMENTS).forEach((node) => node.remove());

  document.querySelectorAll('*').forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;

      if (
        name.startsWith('on')
        || (name === 'href' || name === 'xlink:href' || name === 'src' || name === 'srcset')
        || hasExternalCssReference(value)
      ) {
        element.removeAttribute(attribute.name);
      }
    });

    if (element.tagName.toLowerCase() === 'style' && hasExternalCssReference(element.textContent ?? '')) {
      element.remove();
      if (report) report.droppedStyle = true;
    }
  });

  return root as unknown as SVGSVGElement;
};

export const sanitizeSvg = (svg: string): string => new XMLSerializer().serializeToString(sanitizeSvgElement(svg));
