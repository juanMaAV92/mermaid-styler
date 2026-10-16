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
