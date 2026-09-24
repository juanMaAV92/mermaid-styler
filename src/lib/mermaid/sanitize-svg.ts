import DOMPurify from 'dompurify';
import { MermaidRenderError } from './types';

const isFragmentReference = (value: string) => value.trim().startsWith('#');

const containsExternalCssUrl = (value: string): boolean => {
  const urls = [...value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)].map((match) => match[2].trim());
  return urls.some((url) => url && !isFragmentReference(url));
};

// Mermaid renders HTML labels inside `foreignObject`. Browsers accept `<br>`,
// but the SVG/XML parser used for sanitization requires a self-closing tag.
// Keep the normalization intentionally narrow: it only repairs Mermaid line
// breaks before the document is parsed and sanitized.
const normalizeMermaidLineBreaks = (svg: string): string => svg.replace(
  /<br\b([^>]*)>/gi,
  (match, attributes: string) => (/\/\s*$/.test(attributes) ? match : `<br${attributes}/>`),
);

export const sanitizeSvg = (svg: string): string => {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return svg;
  }

  const document = new DOMParser().parseFromString(normalizeMermaidLineBreaks(svg), 'image/svg+xml');
  const root = document.documentElement;

  if (!root || root.tagName.toLowerCase() !== 'svg' || document.querySelector('parsererror')) {
    throw new MermaidRenderError('SANITIZE_ERROR', 'Mermaid returned an invalid SVG document.');
  }

  document.querySelectorAll('foreignObject').forEach((foreignObject) => {
    const sanitizedLabel = DOMPurify.sanitize(foreignObject.innerHTML, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['style', 'svg', 'math', 'img', 'a', 'iframe', 'object', 'embed', 'link'],
    });
    const labelDocument = new DOMParser().parseFromString(sanitizedLabel, 'text/html');
    foreignObject.replaceChildren(...[...labelDocument.body.childNodes].map((node) => document.importNode(node, true)));
  });

  document.querySelectorAll('script, iframe, object, embed, link, image, img, use').forEach((node) => node.remove());

  document.querySelectorAll('*').forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;

      if (
        name.startsWith('on')
        || (name === 'href' || name === 'xlink:href' || name === 'src' || name === 'srcset')
        || containsExternalCssUrl(value)
      ) {
        element.removeAttribute(attribute.name);
      }
    });

    if (element.tagName.toLowerCase() === 'style' && containsExternalCssUrl(element.textContent ?? '')) {
      element.remove();
    }
  });

  return new XMLSerializer().serializeToString(root);
};
