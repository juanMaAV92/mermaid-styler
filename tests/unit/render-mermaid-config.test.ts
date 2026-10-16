import { beforeEach, describe, expect, it, vi } from 'vitest';

const initialize = vi.fn();

vi.mock('mermaid', () => ({
  default: {
    initialize,
    parse: vi.fn(async () => ({ diagramType: 'flowchart-v2' })),
    render: vi.fn(async () => ({ svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>', diagramType: 'flowchart-v2' })),
  },
}));

const theme = {
  background: '#fff',
  primaryColor: '#fff',
  primaryBorderColor: '#000',
  primaryTextColor: '#000',
  lineColor: '#000',
  accentColor: '#0e7c8c',
  fontFamily: 'Inter',
  fontSize: 16,
  transparent: false,
};

describe('renderMermaid config', () => {
  beforeEach(() => initialize.mockClear());

  it('AUD-021: disables useMaxWidth in every per-diagram config block', async () => {
    const { MERMAID_DIAGRAM_CONFIG_KEYS, renderMermaid } = await import('../../src/lib/mermaid/render-mermaid');
    await renderMermaid('flowchart LR\n  A --> B', { theme });
    const config = initialize.mock.calls[0][0] as Record<string, unknown>;
    for (const key of ['flowchart', 'sequence', 'class', 'state', 'er', 'gantt', 'journey', 'pie', 'requirement',
      'mindmap', 'timeline', 'gitGraph', 'c4', 'sankey', 'xyChart', 'quadrantChart', 'block', 'packet',
      'architecture', 'kanban', 'radar']) {
      expect(MERMAID_DIAGRAM_CONFIG_KEYS).toContain(key);
    }
    for (const key of MERMAID_DIAGRAM_CONFIG_KEYS) {
      expect(config[key], key).toMatchObject({ useMaxWidth: false });
    }
  });
});

describe('renderMermaid source theme (D1)', () => {
  beforeEach(() => initialize.mockClear());

  it('D1: blocks source theme and themeVariables by default', async () => {
    const { MERMAID_SECURE_KEYS, renderMermaid } = await import('../../src/lib/mermaid/render-mermaid');
    await renderMermaid('flowchart LR\n  A --> B', { theme });
    const config = initialize.mock.calls[0][0] as { secure: string[] };
    expect(config.secure).toEqual([...MERMAID_SECURE_KEYS, 'theme', 'themeVariables']);
  });

  it('D1: allowSourceTheme keeps the base secure list (themeCSS stays blocked)', async () => {
    const { MERMAID_SECURE_KEYS, renderMermaid } = await import('../../src/lib/mermaid/render-mermaid');
    await renderMermaid('flowchart LR\n  A --> B', { theme, allowSourceTheme: true });
    const config = initialize.mock.calls[0][0] as { secure: string[] };
    expect(config.secure).toEqual([...MERMAID_SECURE_KEYS]);
    expect(config.secure).toContain('themeCSS');
  });

  it('D1: allowSourceTheme re-derives with source themeVariables when the source sets no theme', async () => {
    const mermaid = (await import('mermaid')).default;
    vi.mocked(mermaid.parse).mockResolvedValueOnce({
      diagramType: 'flowchart-v2',
      config: { themeVariables: { primaryColor: '#ff0000', lineColor: '' } },
    } as never);
    const { renderMermaid } = await import('../../src/lib/mermaid/render-mermaid');
    await renderMermaid('%%{init: {"themeVariables": {"primaryColor": "#ff0000"}}}%%\nflowchart LR\n  A --> B', {
      theme, allowSourceTheme: true,
    });
    expect(initialize).toHaveBeenCalledTimes(2);
    const rederived = initialize.mock.calls[1][0] as { theme: string; themeVariables: Record<string, string> };
    expect(rederived.theme).toBe('base');
    expect(rederived.themeVariables).toMatchObject({ primaryColor: '#ff0000', lineColor: '#000' });
  });

  it('D1: never re-derives with the source theme off', async () => {
    const mermaid = (await import('mermaid')).default;
    vi.mocked(mermaid.parse).mockResolvedValueOnce({
      diagramType: 'flowchart-v2',
      config: { themeVariables: { primaryColor: '#ff0000' } },
    } as never);
    const { renderMermaid } = await import('../../src/lib/mermaid/render-mermaid');
    await renderMermaid('flowchart LR\n  A --> B', { theme });
    expect(initialize).toHaveBeenCalledTimes(1);
  });
});
