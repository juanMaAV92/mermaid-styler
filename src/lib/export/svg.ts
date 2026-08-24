export type SvgMetadata = {
  title: string;
  description: string;
  source: string;
};

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

export const addSvgMetadata = (markup: string, metadata: SvgMetadata) => {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return markup;
  }

  const document = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const root = document.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg') throw new Error('The SVG metadata could not be prepared.');

  root.querySelectorAll('title, desc').forEach((element) => element.remove());
  const titleId = 'mermaid-styler-export-title';
  const descriptionId = 'mermaid-styler-export-description';
  const title = document.createElementNS(SVG_NAMESPACE, 'title');
  const description = document.createElementNS(SVG_NAMESPACE, 'desc');
  const sourceMetadata = document.createElementNS(SVG_NAMESPACE, 'metadata');
  const source = document.createElementNS(SVG_NAMESPACE, 'mermaid-source');

  title.id = titleId;
  title.textContent = metadata.title;
  description.id = descriptionId;
  description.textContent = metadata.description;
  source.textContent = metadata.source;
  sourceMetadata.appendChild(source);
  root.setAttribute('role', 'img');
  root.setAttribute('aria-labelledby', `${titleId} ${descriptionId}`);
  root.insertBefore(title, root.firstChild);
  root.insertBefore(description, title.nextSibling);
  root.appendChild(sourceMetadata);

  return new XMLSerializer().serializeToString(root);
};
