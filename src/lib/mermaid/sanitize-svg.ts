import { MermaidRenderError } from './types';

const isUnsafeUrl = (value: string): boolean => /^(?:javascript:|data:text\/html|https?:|\/\/)/i.test(value.trim());

export const sanitizeSvg = (svg: string): string => {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return svg;
  }

  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = document.documentElement;

  if (!root || root.tagName.toLowerCase() !== 'svg' || document.querySelector('parsererror')) {
    throw new MermaidRenderError('SANITIZE_ERROR', 'Mermaid returned an invalid SVG document.');
  }

  document.querySelectorAll('script, iframe, object, embed, link').forEach((node) => node.remove());

  document.querySelectorAll('*').forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;

      if (name.startsWith('on') || ((name === 'href' || name === 'xlink:href') && isUnsafeUrl(value))) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  return new XMLSerializer().serializeToString(root);
};
