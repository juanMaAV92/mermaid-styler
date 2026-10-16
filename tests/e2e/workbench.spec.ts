import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { acceptDialogs } from './helpers';

test.describe('Mermaid Styler workbench', () => {
  test.beforeEach(({ page }) => acceptDialogs(page));

  test('loads the workbench with the expected controls', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('Mermaid Styler');
    await expect(page.getByRole('textbox', { name: 'Source' })).toHaveValue(/flowchart LR/);
    await expect(page.getByRole('listbox', { name: 'Diagram presets' }).getByRole('option')).toHaveCount(5);
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
    await expect(page.locator('[data-svg-host] svg')).toBeVisible();
    await expect.poll(async () => (
      await page.locator('[data-svg-host] svg').evaluate((svg) => {
        const label = svg.querySelector<HTMLElement>('.nodeLabel');
        const box = label?.closest('foreignObject')?.getBoundingClientRect();
        return Boolean(box && box.width > 0 && box.height > 0);
      })
    )).toBe(true);
    await expect(page.getByRole('button', { name: 'Copy SVG' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Download SVG' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Copy PNG' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
  });

  test('downloads SVG and PNG artifacts from the rendered preview', async ({ page }) => {
    await page.goto('/');

    const svgDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download SVG' }).click();
    await expect((await svgDownload).suggestedFilename()).toBe('mermaid-diagram.svg');

    const pngDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PNG' }).click();
    await expect((await pngDownload).suggestedFilename()).toBe('mermaid-diagram.png');
  });

  test('copies SVG text and PNG image when clipboard permissions are available', async ({ page, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });
    await page.goto('/');

    await page.getByRole('button', { name: 'Copy SVG' }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('<svg');

    await page.getByRole('button', { name: 'Copy PNG' }).click();
    await expect.poll(async () => page.evaluate(async () => {
      const items = await navigator.clipboard.read();
      return items.some((item) => item.types.includes('image/png'));
    })).toBe(true);
  });

  test('preserves the last valid SVG when the next source is invalid', async ({ page }) => {
    await page.goto('/');
    const editor = page.getByRole('textbox', { name: 'Source' });

    await expect(page.locator('[data-svg-host] svg')).toBeVisible();
    await editor.fill('flowchart LR\n  A -->');

    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'error', { timeout: 10_000 });
    await expect(page.locator('[data-svg-host] svg')).toBeVisible();
    await expect(page.locator('[data-last-valid-stamp]')).toBeVisible();
    await expect(page.locator('[data-last-valid-stamp]')).toHaveText(/last valid/i);
    await expect(page.locator('[data-source-feedback]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download SVG' })).toBeEnabled();
  });

  test('updates the rendered SVG when a color control changes', async ({ page }) => {
    await page.goto('/');
    const svgHost = page.locator('[data-svg-host]');
    const primaryColor = page.locator('#primary-color');

    await expect(svgHost.locator('svg')).toBeVisible();
    await primaryColor.evaluate((input) => {
      const colorInput = input as HTMLInputElement;
      colorInput.value = '#ffcc00';
      colorInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
    await expect.poll(async () => (
      (await svgHost.locator('svg').evaluate((svg) => svg.outerHTML)).toLowerCase().includes('#ffcc00')
    )).toBe(true);
  });

  test('zooms and pans the preview without rerendering the SVG', async ({ page }) => {
    await page.goto('/');
    const viewport = page.locator('[data-preview-viewport]');
    const layer = page.locator('[data-preview-layer]');
    const zoom = page.locator('[data-preview-zoom]');

    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
    // AUD-021: the initial zoom is the Fit scale, and Zoom in multiplies it by 1.25.
    const readScale = () => layer.evaluate((element) => Number(element.style.getPropertyValue('--preview-scale')));
    await expect.poll(readScale).toBeGreaterThan(0);
    const fitScale = await readScale();
    await expect(zoom).toHaveText(`${Math.round(fitScale * 100)}%`);
    const initialSvg = await page.locator('[data-svg-host] svg').evaluate((svg) => svg.id);

    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(zoom).toHaveText(`${Math.round(fitScale * 125)}%`);
    expect(await page.locator('[data-svg-host] svg').evaluate((svg) => svg.id)).toBe(initialSvg);

    const box = await viewport.boundingBox();
    if (!box) throw new Error('Preview viewport has no bounding box.');
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 48, centerY + 24);
    await page.mouse.up();

    await expect.poll(() => layer.evaluate((element) => getComputedStyle(element).getPropertyValue('--preview-pan-x').trim())).toBe('48px');
    await expect.poll(() => layer.evaluate((element) => getComputedStyle(element).getPropertyValue('--preview-pan-y').trim())).toBe('24px');

    await viewport.focus();
    await viewport.press('0');
    await expect(zoom).toHaveText('100%');
    await expect(layer).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');

    // AUD-021: Home (and the Fit button) return to the Fit scale.
    await viewport.press('Home');
    await expect(zoom).toHaveText(`${Math.round(fitScale * 100)}%`);
  });

  test('supports preset selection with keyboard navigation', async ({ page }) => {
    await page.goto('/');

    const lightPreset = page.getByRole('option', { name: 'Light' });
    const darkPreset = page.getByRole('option', { name: 'Dark' });

    await lightPreset.click();
    await lightPreset.press('ArrowDown');

    await expect(darkPreset).toHaveAttribute('aria-selected', 'true');
    await expect(darkPreset).toHaveAttribute('tabindex', '0');
  });

  test('communicates the empty source state and keeps the preview safe', async ({ page }) => {
    await page.goto('/');
    const editor = page.getByRole('textbox', { name: 'Source' });

    await editor.fill('');

    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'empty');
    await expect(page.locator('[data-state-view="empty"]')).toBeVisible();
    await expect(page.locator('[data-state-view="ready"]')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Copy SVG' })).toBeDisabled();
  });

  test('stacks the workbench on mobile without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.locator('.workbench')).toHaveCSS('display', 'flex');
    await expect(page.getByRole('region', { name: 'Preview' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Style' })).toBeVisible();

    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(horizontalOverflow).toBe(false);
  });

  test('exports a valid PNG from the mobile layout', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await page.getByRole('button', { name: 'PNG export options' }).click();
    const pngDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PNG' }).click();
    const pngPath = await (await pngDownload).path();
    if (!pngPath) throw new Error('PNG download path is unavailable.');

    expect((await readFile(pngPath)).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  });

  test('AUD-018: parse error shows line and jumps to it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const editor = page.getByRole('textbox', { name: 'Source' });
    await editor.fill('flowchart LR\n A --> B[');

    const feedback = page.locator('[data-source-feedback]');
    await expect(feedback).toContainText(/line 2/i, { timeout: 10_000 });
    await expect(feedback).toBeInViewport();
    await page.getByRole('button', { name: 'Go to line 2' }).click();

    await expect(editor).toBeFocused();
    const selectionStart = await editor.evaluate((el) => (el as HTMLTextAreaElement).selectionStart);
    expect(selectionStart).toBe('flowchart LR\n'.length);
  });

  test('AUD-018: parse error feedback is visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('textbox', { name: 'Source' }).fill('flowchart LR\n A --> B[');
    await expect(page.locator('[data-source-feedback]')).toContainText(/line 2/i, { timeout: 10_000 });
    await expect(page.locator('[data-source-feedback]')).toBeInViewport();
  });

  test('UX: typing invalid source shows no alert before 800ms idle', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
    const editor = page.locator('[data-source-input]');
    const feedback = page.locator('[data-source-feedback]');

    await editor.evaluate((element) => {
      const textarea = element as HTMLTextAreaElement;
      const w = window as unknown as { __lastInputAt: number; __revealedAt: number | null };
      w.__lastInputAt = 0;
      w.__revealedAt = null;
      textarea.addEventListener('input', () => { w.__lastInputAt = performance.now(); });
      const target = document.querySelector<HTMLElement>('[data-source-feedback]');
      if (!target) throw new Error('Missing source feedback.');
      new MutationObserver(() => {
        if (!target.hidden && w.__revealedAt === null) w.__revealedAt = performance.now();
      }).observe(target, { attributes: true, attributeFilter: ['hidden'] });
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });

    await editor.pressSequentially('\n  A --> B[', { delay: 50 });
    expect(await feedback.isHidden()).toBe(true);
    await expect(feedback).toBeVisible({ timeout: 3_000 });
    await expect(editor).toBeFocused();

    const timing = await page.evaluate(() => {
      const w = window as unknown as { __lastInputAt: number; __revealedAt: number | null };
      return { lastInputAt: w.__lastInputAt, revealedAt: w.__revealedAt };
    });
    expect(timing.revealedAt).not.toBeNull();
    expect((timing.revealedAt ?? 0) - timing.lastInputAt).toBeGreaterThanOrEqual(790);
  });

  test('UX: previous diagram stays visible and exports stay enabled while rendering', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
    await expect(page.locator('[data-svg-host] svg')).toBeVisible();

    await page.evaluate(() => {
      const w = window as unknown as { __flags: { svgHidden: boolean; actionDisabled: boolean }; __stopWatch: () => void };
      w.__flags = { svgHidden: false, actionDisabled: false };
      const check = () => {
        const svg = document.querySelector<SVGSVGElement>('[data-svg-host] svg');
        if (!svg || !svg.checkVisibility()) w.__flags.svgHidden = true;
        if ([...document.querySelectorAll<HTMLButtonElement>('[data-action]')].some((button) => button.disabled)) {
          w.__flags.actionDisabled = true;
        }
      };
      const observer = new MutationObserver(check);
      observer.observe(document.body, { attributes: true, childList: true, subtree: true });
      let frame = 0;
      const loop = () => { check(); frame = requestAnimationFrame(loop); };
      loop();
      w.__stopWatch = () => { observer.disconnect(); cancelAnimationFrame(frame); };
    });

    const slider = page.locator('#text-size');
    for (const value of ['15', '17', '19', '16', '18']) {
      await slider.fill(value);
      await page.waitForTimeout(120);
    }
    await expect(page.locator('[data-text-size]')).toHaveText('18px');
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
    await expect(page.locator('[data-artifact-stage]')).not.toHaveClass(/stage-rendering-overlay/);

    const flags = await page.evaluate(() => {
      const w = window as unknown as { __flags: { svgHidden: boolean; actionDisabled: boolean }; __stopWatch: () => void };
      w.__stopWatch();
      return w.__flags;
    });
    expect(flags).toEqual({ svgHidden: false, actionDisabled: false });
  });

  test('A11y: exactly one live region', async ({ page }) => {
    const expectSingleLiveRegion = async () => {
      await expect(page.getByRole('status')).toHaveCount(1);
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect(page.locator('[aria-live]')).toHaveCount(1);
      await expect(page.locator('[aria-live]')).toHaveAttribute('data-live-status', '');
      await expect(page.getByRole('status')).toHaveAttribute('data-live-status', '');
    };

    await page.goto('/');
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
    await expectSingleLiveRegion();

    const editor = page.getByRole('textbox', { name: 'Source' });
    await editor.fill('flowchart LR\n  A --> B[');
    await expect(page.locator('[data-source-feedback]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-live-status]')).toContainText(/invalid/i);
    await expectSingleLiveRegion();

    await editor.fill('flowchart LR\n  A --> B');
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
    await expect(page.locator('[data-source-feedback]')).toBeHidden();
    await expectSingleLiveRegion();
  });

  test('AUD-020: no scaffold copy in the shipped page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });

    await expect(page.getByText(/connects next|Scaffold|Example artifact|next phase|Renderer next/i)).toHaveCount(0);
    await expect(page.locator('kbd')).toHaveCount(0);
    await expect(page.locator('[data-scaffold-preview]')).toHaveCount(0);
    await expect(page.locator('.app-footer').getByText('Paste Mermaid to start styling')).toBeHidden();
    await expect(page.locator('[data-current-preset]')).toHaveText('Light');

    await page.getByRole('option', { name: /Dark/ }).click();
    await expect(page.locator('[data-current-preset]')).toHaveText('Dark');

    await page.getByRole('textbox', { name: 'Source' }).fill('');
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'empty');
    await expect(page.locator('.app-footer').getByText('Paste Mermaid to start styling')).toBeVisible();
  });

  const chain = (direction: 'LR' | 'TD', count = 12) => [
    `flowchart ${direction}`,
    ...Array.from({ length: count - 1 }, (_, index) => `  N${index}[Step ${index}] --> N${index + 1}[Step ${index + 1}]`),
  ].join('\n');

  const renderSource = async (page: Page, source: string) => {
    const stage = page.locator('[data-artifact-stage]');
    await expect(stage).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
    const svg = page.locator('[data-svg-host] svg');
    const before = await svg.evaluate((element) => element.id);
    await page.getByRole('textbox', { name: 'Source' }).fill(source);
    await expect.poll(() => svg.evaluate((element) => element.id), { timeout: 10_000 }).not.toBe(before);
    await expect(stage).toHaveAttribute('data-render-state', 'ready');
  };

  const fitMetrics = (page: Page) => page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>('[data-preview-viewport]')!;
    const svg = document.querySelector<SVGSVGElement>('[data-svg-host] svg')!;
    const v = viewport.getBoundingClientRect();
    const b = svg.getBoundingClientRect();
    return {
      inside: b.left >= v.left - 2 && b.top >= v.top - 2 && b.right <= v.right + 2 && b.bottom <= v.bottom + 2,
      fill: Math.max(b.width / v.width, b.height / v.height),
      viewportHeight: viewport.clientHeight,
      innerHeight: window.innerHeight,
    };
  });

  for (const [name, direction] of [['wide', 'LR'], ['tall', 'TD']] as const) {
    test(`AUD-021: rendered diagram fits the viewport (${name})`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      await renderSource(page, chain(direction));

      await expect.poll(async () => {
        const metrics = await fitMetrics(page);
        return metrics.inside && metrics.fill >= 0.8;
      }, { timeout: 5_000 }).toBe(true);
      const metrics = await fitMetrics(page);
      // The viewport must not grow to the diagram's unscaled height.
      expect(metrics.viewportHeight).toBeLessThan(metrics.innerHeight);
    });
  }

  test('AUD-021: wheel without modifier scrolls the page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
    expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeGreaterThan(0);
    const zoom = page.locator('[data-preview-zoom]');
    const zoomBefore = await zoom.textContent();
    const box = await page.locator('[data-preview-viewport]').boundingBox();
    if (!box) throw new Error('Preview viewport has no bounding box.');
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 300));

    await page.mouse.wheel(0, 300);

    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(zoom).toHaveText(zoomBefore ?? '');
  });

  test('AUD-021: ctrl+wheel zooms', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
    const zoom = page.locator('[data-preview-zoom]');
    const zoomBefore = await zoom.textContent();
    const box = await page.locator('[data-preview-viewport]').boundingBox();
    if (!box) throw new Error('Preview viewport has no bounding box.');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    await page.keyboard.down('Control');
    await page.mouse.wheel(0, 200);
    await page.keyboard.up('Control');

    await expect(zoom).not.toHaveText(zoomBefore ?? '');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('AUD-021: arrow keys in viewport do not scroll the page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
    const viewport = page.locator('[data-preview-viewport]');
    await viewport.focus();
    const scrollBefore = await page.evaluate(() => window.scrollY);

    for (let i = 0; i < 3; i += 1) await viewport.press('ArrowDown');
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  });

  test('AUD-021: style-only re-render keeps the zoom', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
    const zoom = page.locator('[data-preview-zoom]');
    await page.getByRole('button', { name: 'Zoom in' }).click();
    const zoomed = await zoom.textContent();
    const svg = page.locator('[data-svg-host] svg');
    const before = await svg.evaluate((element) => element.id);

    await page.locator('#primary-color').evaluate((input) => {
      const colorInput = input as HTMLInputElement;
      colorInput.value = '#ffcc00';
      colorInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await expect.poll(() => svg.evaluate((element) => element.id), { timeout: 10_000 }).not.toBe(before);
    await expect(zoom).toHaveText(zoomed ?? '');
  });

  test('AUD-021: large-diagram hint stays hidden for the default sample on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
    await expect.poll(() => page.locator('[data-preview-layer]').evaluate((element) => Number(element.style.getPropertyValue('--preview-scale'))))
      .toBeLessThan(0.5);
    await expect(page.locator('[data-preview-large-hint]')).toBeHidden();
  });

  test('AUD-021: large-diagram hint shows for a long chain after fit', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await renderSource(page, chain('LR', 40));
    await expect(page.locator('[data-preview-large-hint]')).toBeVisible();
    await expect(page.locator('[data-preview-large-hint]')).toHaveCSS('font-size', '11px');
  });

  test('AUD-021: export actions are unambiguous on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const names = ['Download SVG', 'Copy SVG', 'Download PNG', 'Copy PNG'];
    for (const name of names) {
      await expect(page.locator('.topbar-actions').getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(page.locator('.topbar-actions button:visible')).toHaveCount(4);
  });

  test('AUD-021: export actions are unambiguous on mobile', async ({ page, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });

    const visible = page.locator('.topbar-actions button:visible');
    await expect(visible).toHaveCount(2);
    const names: string[] = [];
    for (let i = 0; i < 2; i += 1) {
      const button = visible.nth(i);
      names.push((await button.getAttribute('aria-label')) ?? '');
      expect(((await button.innerText()) ?? '').trim().length).toBeGreaterThan(0);
      const box = await button.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    expect(new Set(names).size).toBe(2);
    expect(await page.locator('.topbar-actions button:visible').allInnerTexts()).toEqual(['SVG', 'PNG']);

    await page.getByRole('button', { name: 'PNG export options' }).click();
    const download = page.getByRole('button', { name: 'Download PNG' });
    const copy = page.getByRole('button', { name: 'Copy PNG' });
    await expect(download).toBeVisible();
    await expect(copy).toBeVisible();
    for (const item of [download, copy]) {
      const box = await item.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await copy.click();
    await expect(page.locator('[data-live-status]')).toHaveText(/PNG copied/);
    await expect(copy).toBeHidden();
  });
});
