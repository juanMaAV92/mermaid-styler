import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const fixtures = [
  {
    name: 'flowchart',
    source: 'flowchart LR\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Done]\n  B -->|No| D[Retry]',
  },
  {
    name: 'sequence',
    source: 'sequenceDiagram\n  participant User\n  participant API\n  User->>API: Request\n  API-->>User: Response',
  },
  {
    name: 'class',
    source: 'classDiagram\n  class User {\n    +String name\n    +login()\n  }\n  class Account\n  User --> Account',
  },
  {
    name: 'state',
    source: 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Active\n  Active --> [*]',
  },
  {
    name: 'er',
    source: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places\n  CUSTOMER {\n    string id PK\n  }\n  ORDER {\n    string id PK\n  }',
  },
];

const waitForReady = async (page: Page, previousSvgId?: string) => {
  if (previousSvgId) {
    await expect.poll(
      () => page.locator('[data-svg-host] svg').getAttribute('id'),
      { timeout: 10_000 },
    ).not.toBe(previousSvgId);
  }
  await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
  await expect(page.locator('[data-svg-host] svg')).toBeVisible();
};

test.describe('Mermaid Styler hardening', () => {
  test('renders the supported diagram-family matrix', async ({ page }) => {
    await page.goto('/');
    const editor = page.getByRole('textbox', { name: 'Paste a Mermaid definition here…' });
    let previousSvgId = await page.locator('[data-svg-host] svg').getAttribute('id');

    for (const fixture of fixtures) {
      await editor.fill(fixture.source);
      await waitForReady(page, previousSvgId ?? undefined);
      await expect(page.locator('[data-svg-host] svg')).toHaveCount(1);
      expect(await page.locator('[data-svg-host] svg *').count()).toBeGreaterThan(0);
      previousSvgId = await page.locator('[data-svg-host] svg').getAttribute('id');
    }
  });

  test('exports complex Unicode, long-label and transparent diagrams', async ({ page }) => {
    await page.goto('/');
    const editor = page.getByRole('textbox', { name: 'Paste a Mermaid definition here…' });
    const longLabel = '🚀 Plataforma internacional — مرحباً بالعالم — 中文 — '.repeat(8);
    const source = `flowchart LR\n  A["${longLabel}"] --> B["日本語 ✅ ${longLabel}"]`;
    const previousSvgId = await page.locator('[data-svg-host] svg').getAttribute('id');

    await editor.fill(source);
    await waitForReady(page, previousSvgId ?? undefined);
    await page.getByRole('checkbox', { name: 'Transparent background' }).check();
    await expect(page.locator('[data-artifact-stage]')).toHaveClass(/is-transparent/);

    const svgDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export SVG' }).click();
    const svg = await svgDownload;
    const svgPath = await svg.path();
    if (!svgPath) throw new Error('SVG download path is unavailable.');
    const svgContent = await readFile(svgPath, 'utf8');
    expect(svgContent).toContain('<title');
    expect(svgContent).toContain('<desc');
    expect(svgContent).toContain('mermaid-source');
    expect(svgContent).toContain('🚀');

    const pngDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export PNG' }).click();
    const png = await pngDownload;
    const pngPath = await png.path();
    if (!pngPath) throw new Error('PNG download path is unavailable.');
    const pngContent = await readFile(pngPath);
    expect(pngContent.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(pngContent.byteLength).toBeGreaterThan(1_000);
  });

  test('keeps render resources bounded across 20 consecutive renders', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/');
    const editor = page.getByRole('textbox', { name: 'Paste a Mermaid definition here…' });
    let previousSvgId = await page.locator('[data-svg-host] svg').getAttribute('id');

    for (let index = 0; index < 20; index += 1) {
      await editor.fill(`flowchart LR\n  A[Render ${index}] --> B[🚀 Stable]`);
      await waitForReady(page, previousSvgId ?? undefined);
      previousSvgId = await page.locator('[data-svg-host] svg').getAttribute('id');
    }

    const resources = await page.evaluate(() => ({
      temporaryMermaidNodes: document.querySelectorAll('[data-mermaid-temporary]').length,
      renderedSvgs: document.querySelectorAll('[data-svg-host] svg').length,
      canvases: document.querySelectorAll('canvas').length,
      heapUsed: 'memory' in performance
        ? (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null
        : null,
    }));

    expect(resources.temporaryMermaidNodes).toBe(0);
    expect(resources.renderedSvgs).toBe(1);
    expect(resources.canvases).toBe(0);
    test.info().annotations.push({ type: 'resource-audit', description: JSON.stringify(resources) });
  });
});
