import { copyPngToClipboard, copyTextToClipboard } from '../lib/export/clipboard';
import { downloadBlob } from '../lib/export/download';
import { type PngExportOptions, svgToPngBlob } from '../lib/export/png';

type ArtifactActionMessages = {
  svgExported: string;
  pngExported: string;
  pngExportedReduced: string;
  svgCopied: string;
  pngCopied: string;
  pngCopiedReduced: string;
  pngClipboardFallback: string;
  artifactActionError: string;
};

type ArtifactActionsOptions = {
  getRenderedSvg: () => SVGSVGElement | null | undefined;
  getExportSvgMarkup: () => string;
  getPngOptions: () => PngExportOptions;
  messages: ArtifactActionMessages;
  announce: (message: string) => void;
};

export const createArtifactActionHandler = ({
  getRenderedSvg,
  getExportSvgMarkup,
  getPngOptions,
  messages,
  announce,
}: ArtifactActionsOptions) => {
  const createPng = async () => {
    const svg = getRenderedSvg();
    if (!svg) throw new Error('No rendered SVG is available.');
    return svgToPngBlob(svg, getPngOptions());
  };

  return async (action: string) => {
    try {
      if (action === 'export-svg') {
        const blob = new Blob([getExportSvgMarkup()], { type: 'image/svg+xml;charset=utf-8' });
        downloadBlob(blob, 'mermaid-diagram.svg');
        announce(messages.svgExported);
      }

      if (action === 'copy-svg') {
        await copyTextToClipboard(getExportSvgMarkup());
        announce(messages.svgCopied);
      }

      if (action === 'export-png') {
        const png = await createPng();
        downloadBlob(png.blob, 'mermaid-diagram.png');
        announce(png.wasScaled ? messages.pngExportedReduced : messages.pngExported);
      }

      if (action === 'copy-png') {
        const png = await createPng();
        if (await copyPngToClipboard(png.blob)) {
          announce(png.wasScaled ? messages.pngCopiedReduced : messages.pngCopied);
        } else {
          downloadBlob(png.blob, 'mermaid-diagram.png');
          announce(messages.pngClipboardFallback);
        }
      }
    } catch {
      announce(messages.artifactActionError);
    }
  };
};
