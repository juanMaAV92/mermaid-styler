import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { acceptDialogs } from './helpers';

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

const htmlLabelFlowchart = readFileSync(new URL('../fixtures/diagrams/html-label-flowchart.mmd', import.meta.url), 'utf8');
const themeCssImageSet = readFileSync(new URL('../fixtures/adversarial/mermaid/themecss-image-set.mmd', import.meta.url), 'utf8');
const edges501 = readFileSync(new URL('../fixtures/adversarial/mermaid/edges-501.mmd', import.meta.url), 'utf8');
const initPrimaryRed = readFileSync(new URL('../fixtures/adversarial/mermaid/init-primary-red.mmd', import.meta.url), 'utf8');
const frontmatterPrimaryRed = readFileSync(new URL('../fixtures/adversarial/mermaid/frontmatter-primary-red.mmd', import.meta.url), 'utf8');

const svgMarkup = (page: Page) => page.locator('[data-svg-host] svg').evaluate((svg) => svg.outerHTML);

const firstNodeFill = (page: Page) => page.locator('[data-svg-host] svg g.node')
  .first()
  .locator('rect, polygon, path, circle')
  .first()
  .evaluate((shape) => getComputedStyle(shape).fill);

const setPrimaryColor = async (page: Page, value: string) => {
  await page.locator('#primary-color').evaluate((input, color) => {
    const colorInput = input as HTMLInputElement;
    colorInput.value = color;
    colorInput.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
};

const fillSourceAndWait = async (page: Page, source: string) => {
  const before = await svgMarkup(page);
  await page.locator('[data-source-input]').fill(source);
  await waitForReady(page, before);
};

/**
 * AUD-013: record every request (any origin, including same-origin and failed/CSP-blocked ones) made after the app's
 * initial render. Call it once the first preview is ready so the app's own initial assets are excluded.
 */
const recordRequests = (page: Page) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('requestfailed', (request) => requests.push(`FAILED ${request.url()} ${request.failure()?.errorText ?? ''}`.trim()));
  return requests;
};

const waitForReady = async (page: Page, previousSvgMarkup?: string) => {
  if (previousSvgMarkup) {
    await expect.poll(
      () => page.locator('[data-svg-host] svg').evaluate((svg) => svg.outerHTML),
      { timeout: 10_000 },
    ).not.toBe(previousSvgMarkup);
  }
  await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
  await expect(page.locator('[data-svg-host] svg')).toBeVisible();
};

test.describe('Mermaid Styler hardening', () => {
  test.beforeEach(({ page }) => acceptDialogs(page));

  test('renders the supported diagram-family matrix', async ({ page }) => {
    await page.goto('/');
    const editor = page.getByRole('textbox', { name: 'Source' });
    let previousSvgMarkup = await page.locator('[data-svg-host] svg').evaluate((svg) => svg.outerHTML);

    for (const fixture of fixtures) {
      await editor.fill(fixture.source);
      await waitForReady(page, previousSvgMarkup);
      await expect(page.locator('[data-svg-host] svg')).toHaveCount(1);
      expect(await page.locator('[data-svg-host] svg *').count()).toBeGreaterThan(0);
      previousSvgMarkup = await page.locator('[data-svg-host] svg').evaluate((svg) => svg.outerHTML);
    }
  });

  test('renders Mermaid HTML line breaks without rejecting the generated SVG', async ({ page }) => {
    await page.goto('/');
    const editor = page.getByRole('textbox', { name: 'Source' });
    const previousSvgMarkup = await page.locator('[data-svg-host] svg').evaluate((svg) => svg.outerHTML);

    await editor.fill(htmlLabelFlowchart);
    await waitForReady(page, previousSvgMarkup);
    await expect(page.getByRole('button', { name: 'Download SVG' })).toBeEnabled();
    await expect(page.locator('[data-source-feedback]')).toBeHidden();
  });

  test('exports complex Unicode, long-label and transparent diagrams', async ({ page }) => {
    await page.goto('/');
    const editor = page.getByRole('textbox', { name: 'Source' });
    const longLabel = '🚀 Plataforma internacional — مرحباً بالعالم — 中文 — '.repeat(8);
    const source = `flowchart LR\n  A["${longLabel}"] --> B["日本語 ✅ ${longLabel}"]`;
    const previousSvgMarkup = await page.locator('[data-svg-host] svg').evaluate((svg) => svg.outerHTML);

    await editor.fill(source);
    await waitForReady(page, previousSvgMarkup);
    await page.getByRole('checkbox', { name: 'Transparent background' }).check();
    await expect(page.locator('[data-artifact-stage]')).toHaveClass(/is-transparent/);

    const svgDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download SVG' }).click();
    const svg = await svgDownload;
    const svgPath = await svg.path();
    if (!svgPath) throw new Error('SVG download path is unavailable.');
    const svgContent = await readFile(svgPath, 'utf8');
    expect(svgContent).toContain('<title');
    expect(svgContent).toContain('<desc');
    expect(svgContent).not.toContain('mermaid-source');
    expect(svgContent).not.toContain(longLabel);

    await page.getByRole('checkbox', { name: 'Include Mermaid source in SVG' }).check();
    const sourceSvgDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download SVG' }).click();
    const sourceSvg = await sourceSvgDownload;
    const sourceSvgPath = await sourceSvg.path();
    if (!sourceSvgPath) throw new Error('SVG download path is unavailable.');
    const sourceSvgContent = await readFile(sourceSvgPath, 'utf8');
    expect(sourceSvgContent).toContain('mermaid-source');
    expect(sourceSvgContent).toContain('🚀');

    const pngDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PNG' }).click();
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
    const editor = page.getByRole('textbox', { name: 'Source' });
    let previousSvgMarkup = await page.locator('[data-svg-host] svg').evaluate((svg) => svg.outerHTML);
    const startedAt = Date.now();

    for (let index = 0; index < 20; index += 1) {
      await editor.fill(`flowchart LR\n  A[Render ${index}] --> B[🚀 Stable]`);
      await waitForReady(page, previousSvgMarkup);
      previousSvgMarkup = await page.locator('[data-svg-host] svg').evaluate((svg) => svg.outerHTML);
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
    expect(Date.now() - startedAt).toBeLessThan(20_000);
    test.info().annotations.push({ type: 'resource-audit', description: JSON.stringify(resources) });
  });

  const readDownload = async (download: { path(): Promise<string | null> }) => {
    const path = await download.path();
    if (!path) throw new Error('Download path is unavailable.');
    return readFile(path, 'utf8');
  };

  test('AUD-019: include-source export embeds last rendered source', async ({ page }) => {
    await page.goto('/');
    const editor = page.getByRole('textbox', { name: 'Source' });
    const sourceA = 'flowchart LR\n  A[SourceAlpha] --> B[Done]';
    const sourceB = 'flowchart LR\n  A[SourceBeta] -->';
    const previous = await page.locator('[data-svg-host] svg').evaluate((svg) => svg.outerHTML);
    await editor.fill(sourceA);
    await waitForReady(page, previous);
    await expect(page.locator('[data-action]').first()).not.toHaveAttribute('data-stale', /.*/);

    await editor.fill(sourceB);
    await expect(page.locator('[data-source-feedback]')).toBeVisible({ timeout: 10_000 });
    const buttons = page.locator('[data-action]');
    for (let index = 0; index < (await buttons.count()); index += 1) {
      await expect(buttons.nth(index)).toHaveAttribute('data-stale', 'true');
      await expect(buttons.nth(index)).toHaveAttribute('title', /last valid preview/);
    }

    await page.getByRole('checkbox', { name: 'Include Mermaid source in SVG' }).check();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download SVG' }).click();
    const content = await readDownload(await download);
    expect(content).toContain('SourceAlpha');
    expect(content).not.toContain('SourceBeta');

    await editor.fill(sourceA);
    await expect(page.locator('[data-source-feedback]')).toBeHidden({ timeout: 10_000 });
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready');
    await expect(buttons.first()).not.toHaveAttribute('data-stale', /.*/);
    await expect(buttons.first()).toHaveAttribute('title', 'Download SVG');
  });

  test('AUD-019: exported SVG with HTML labels is well-formed XML', async ({ page, context, browserName }) => {
    if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    const editor = page.getByRole('textbox', { name: 'Source' });
    const previous = await page.locator('[data-svg-host] svg').evaluate((svg) => svg.outerHTML);
    await editor.fill(htmlLabelFlowchart);
    await waitForReady(page, previous);

    const parse = (text: string) => page.evaluate((markup) => {
      const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
      return { root: doc.documentElement.tagName, errors: doc.querySelectorAll('parsererror').length };
    }, text);

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download SVG' }).click();
    const parsed = await parse(await readDownload(await download));
    expect(parsed).toEqual({ root: 'svg', errors: 0 });

    if (browserName === 'chromium') {
      await page.getByRole('button', { name: 'Copy SVG' }).click();
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('<svg');
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      expect(await parse(copied)).toEqual({ root: 'svg', errors: 0 });
    }
  });

  test('AUD-013: themeCSS directive triggers no request', async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    const requests = recordRequests(page);
    await fillSourceAndWait(page, themeCssImageSet);
    expect(requests).toEqual([]);
  });

  for (const label of [
    { name: 'external <img>', source: 'flowchart LR\n  A["<img src=\'https://evil.example/label.png\'> hi"] --> B' },
    { name: 'relative <img>', source: 'flowchart LR\n  A["<img src=\'probe-label.png\'> hi"] --> B' },
    { name: 'style url()', source: 'flowchart LR\n  A["<span style=\'background:url(https://evil.example/span.png)\'>x</span>"] --> B' },
    { name: 'external <input type=image>', source: 'flowchart LR\n  A["<input type=\'image\' src=\'https://evil.example/in.png\'> hi"] --> B' },
    { name: 'video poster', source: 'flowchart LR\n  A["<video poster=\'https://evil.example/poster.png\'></video> hi"] --> B' },
    {
      // Mermaid's sanitizeDirective already deletes the nested FORBID_TAGS key, so this case passes even without
      // 'dompurifyConfig' in MERMAID_SECURE_KEYS; the unit test is the guard for the secure key itself.
      name: 'external <img> and a dompurifyConfig directive',
      source: '%%{init: {"dompurifyConfig": {"FORBID_TAGS": []}}}%%\nflowchart LR\n  A["<img src=\'https://evil.example/label.png\'> hi"] --> B',
    },
  ]) {
    test(`AUD-013: HTML label with ${label.name} triggers no request`, async ({ page }) => {
      await page.goto('/');
      await waitForReady(page);
      const requests = recordRequests(page);
      await fillSourceAndWait(page, label.source);
      // Give late image/CSS fetches from the off-screen layout container time to surface.
      await page.waitForTimeout(500);
      expect(requests).toEqual([]);
      const markup = await svgMarkup(page);
      expect(markup).not.toContain('evil.example');
      expect(markup).not.toContain('probe-label');
    });
  }

  test('AUD-013: label sanitizing keeps text formatting and markdown labels', async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    await fillSourceAndWait(page, 'flowchart LR\n  A["<b>bold</b><br/><i>it</i> plain"] --> B["`**md** _em_`"]');
    const labels = page.locator('[data-svg-host] svg g.node foreignObject');
    await expect(labels.first().locator('b')).toHaveText('bold');
    await expect(labels.first().locator('i')).toHaveText('it');
    await expect(labels.first().locator('br')).toHaveCount(1);
    await expect(labels.nth(1).locator('strong')).toHaveText('md');
    await expect(labels.nth(1).locator('em')).toHaveText('em');
  });

  test('AUD-013: label sanitizing keeps Mermaid style and classDef text colours', async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    await fillSourceAndWait(
      page,
      'flowchart LR\n  A[Alpha] --> B[Beta]\n  style A color:#ff0000\n  classDef c color:#00ff00\n  class B c',
    );
    const labelColor = (id: string) => page.locator(`[data-svg-host] svg g.node[id*="-${id}-"] .nodeLabel`).first()
      .evaluate((label) => getComputedStyle(label).color);
    expect(await labelColor('A')).toBe('rgb(255, 0, 0)');
    expect(await labelColor('B')).toBe('rgb(0, 255, 0)');
  });

  test('AUD-016: 501 edges are rejected with the 500 limit and no long task', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-source-input]').fill(edges501);
    await page.evaluate(() => {
      const w = window as unknown as { __longTasks: number[] };
      w.__longTasks = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) w.__longTasks.push(entry.duration);
      }).observe({ type: 'longtask', buffered: false });
    });
    await expect(page.locator('[data-source-feedback]')).toContainText(/500/, { timeout: 10_000 });
    const longTasks = await page.evaluate(() => (window as unknown as { __longTasks: number[] }).__longTasks);
    expect(longTasks.filter((d) => d > 100)).toEqual([]);
  });

  test('AUD-013: default secure keys stay protected', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-source-input]').fill('%%{init: {"maxEdges": 2}}%%\nflowchart LR\n  A --> B\n  B --> C\n  C --> D');
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
    await expect(page.locator('[data-svg-host] svg')).toBeVisible();
  });

  test('AUD-013: fontFamily directive cannot smuggle external CSS into the SVG', async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    const requests = recordRequests(page);
    await fillSourceAndWait(
      page,
      '%%{init: {"fontFamily": "x; background-image: \\\\75 rl(https://evil.example/a.png)"}}%%\nflowchart LR\n  A --> B',
    );
    const markup = await svgMarkup(page);
    expect(requests).toEqual([]);
    expect(markup).not.toContain('evil.example');
    expect(markup).not.toContain('\\75 rl');
  });
  for (const variant of [
    { name: 'init directive', source: () => initPrimaryRed, sourceFill: 'rgb(255, 0, 0)' },
    // `theme: dark` derives node fill from its own fixed mainBkg (#1f2020), not from primaryColor.
    { name: 'YAML frontmatter config', source: () => frontmatterPrimaryRed, sourceFill: 'rgb(31, 32, 32)' },
  ]) {
    test(`D1: style rail wins over ${variant.name} by default`, async ({ page }) => {
      await page.goto('/');
      await waitForReady(page);
      const notice = page.locator('[data-source-theme-notice]');
      const toggle = page.getByRole('checkbox', { name: 'Use source theme' });
      await expect(notice).toBeHidden();
      await expect(toggle).not.toBeChecked();

      await fillSourceAndWait(page, variant.source());
      await expect(notice).toBeVisible();
      await expect(notice).toHaveText('This source sets its own theme; your style settings take priority.');

      let before = await svgMarkup(page);
      await setPrimaryColor(page, '#00ff00');
      await waitForReady(page, before);
      await expect.poll(() => firstNodeFill(page)).toBe('rgb(0, 255, 0)');

      before = await svgMarkup(page);
      await toggle.check({ force: true });
      await waitForReady(page, before);
      await expect.poll(() => firstNodeFill(page)).toBe(variant.sourceFill);
      await expect(notice).toHaveText('Using the theme defined in the source.');

      before = await svgMarkup(page);
      await page.getByRole('button', { name: 'Reset styles' }).click();
      await waitForReady(page, before);
      await expect(toggle).not.toBeChecked();
      await expect(notice).toHaveText('This source sets its own theme; your style settings take priority.');

      await fillSourceAndWait(page, 'flowchart LR\n  A --> B');
      await expect(notice).toBeHidden();
    });
  }

  test('D1: a bad source theme colour does not wedge later renders', async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    await page.getByRole('checkbox', { name: 'Use source theme' }).check({ force: true });
    await page.locator('[data-source-input]').fill(
      '%%{init: {"theme": "base", "themeVariables": {"primaryColor": "url(evilrel1)"}}}%%\nflowchart LR\n  A --> B',
    );
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', /error|ready/, { timeout: 10_000 });
    await page.locator('[data-source-input]').blur();
    await page.locator('[data-source-input]').fill('flowchart LR\n  X --> Y');
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
    await expect(page.locator('[data-svg-host] svg g.node')).toHaveText(['X', 'Y']);
  });

  test('M2: a source theme variable with a relative url() shows a dropped-styles notice', async ({ page }) => {
    await page.goto('/');
    await waitForReady(page);
    const notice = page.locator('[data-source-theme-notice]');
    await page.getByRole('checkbox', { name: 'Use source theme' }).check({ force: true });
    await fillSourceAndWait(page, '%%{init: {"themeVariables": {"lineColor": "url(evilrel1)"}}}%%\nflowchart LR\n  A --> B');
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready');
    await expect(notice).toBeVisible();
    await expect(notice).toHaveText('Some diagram styles were removed because they reference external resources.');
    expect(await svgMarkup(page)).not.toContain('evilrel1');

    await fillSourceAndWait(page, 'flowchart LR\n  X --> Y');
    await expect(notice).toBeHidden();
  });

  test('D1: non-theme init options still apply with the source theme off', async ({ page }) => {
    const firstEdgePath = () => page.locator('[data-svg-host] svg .flowchart-link').first().getAttribute('d');
    await page.goto('/');
    await waitForReady(page);
    await expect(page.getByRole('checkbox', { name: 'Use source theme' })).not.toBeChecked();
    await fillSourceAndWait(page, 'flowchart TD\n  A --> B\n  A --> C\n  B --> D\n  C --> D');
    const defaultCurve = await firstEdgePath();
    await fillSourceAndWait(page, '%%{init: {"flowchart": {"curve": "linear"}}}%%\nflowchart TD\n  A --> B\n  A --> C\n  B --> D\n  C --> D');
    const linearCurve = await firstEdgePath();
    await fillSourceAndWait(page, '%%{init: {"flowchart": {"curve": "step"}}}%%\nflowchart TD\n  A --> B\n  A --> C\n  B --> D\n  C --> D');
    const stepCurve = await firstEdgePath();
    expect(defaultCurve).toBeTruthy();
    expect(new Set([defaultCurve, linearCurve, stepCurve]).size).toBe(3);
  });

  test('AUD-017: HTML label with <img> renders', async ({ page }) => {
    await page.goto('/');
    const before = await page.locator('[data-svg-host] svg').evaluate((svg) => svg.outerHTML);
    await page.locator('[data-source-input]').fill('flowchart LR\n  A["<b>bold</b> <img src=x>"] --> B');
    await expect.poll(
      () => page.locator('[data-svg-host] svg').evaluate((svg) => svg.outerHTML),
      { timeout: 10_000 },
    ).not.toBe(before);
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready');
    await expect(page.locator('[data-source-feedback]')).toBeHidden();
    const markup = await page.locator('[data-svg-host] svg').evaluate((svg) => svg.outerHTML);
    expect(markup).not.toContain('<img');
    expect(markup).toContain('bold');
  });
});
