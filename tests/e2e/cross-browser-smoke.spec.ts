import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { acceptDialogs } from './helpers';

test.describe('Cross-browser smoke', () => {
  test.beforeEach(({ page }) => acceptDialogs(page));

  test('renders a diagram, applies a preset and preserves the last valid artifact', async ({ page }) => {
    await page.goto('/');

    const stage = page.locator('[data-artifact-stage]');
    const editor = page.getByRole('textbox', { name: 'Source' });
    await expect(stage).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
    await expect(page.locator('[data-svg-host] svg')).toBeVisible();

    await page.getByRole('option', { name: 'Dark' }).click();
    await expect(page.getByRole('option', { name: 'Dark' })).toHaveAttribute('aria-selected', 'true');
    await expect(stage).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });

    const pngDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PNG' }).click();
    const pngPath = await (await pngDownload).path();
    if (!pngPath) throw new Error('PNG download path is unavailable.');
    expect((await readFile(pngPath)).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

    await editor.fill('flowchart LR\n  A -->');
    await expect(stage).toHaveAttribute('data-render-state', 'error', { timeout: 10_000 });
    await expect(page.locator('[data-svg-host] svg')).toBeVisible();
  });
  test('AUD-017: HTML label with <img> renders in every engine', async ({ page }) => {
    await page.goto('/');
    const stage = page.locator('[data-artifact-stage]');
    await expect(stage).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
    const before = await page.locator('[data-svg-host] svg').evaluate((svg) => svg.outerHTML);
    await page.getByRole('textbox', { name: 'Source' }).fill('flowchart LR\n  A["<b>bold</b> <img src=x><hr>"] --> B');
    await expect.poll(
      () => page.locator('[data-svg-host] svg').evaluate((svg) => svg.outerHTML),
      { timeout: 10_000 },
    ).not.toBe(before);
    await expect(stage).toHaveAttribute('data-render-state', 'ready');
    const markup = await page.locator('[data-svg-host] svg').evaluate((svg) => svg.outerHTML);
    expect(markup).not.toContain('<img');
    expect(markup).toContain('bold');
  });

  test('AUD-017: malformed SVG is detectable by the sanitizer root check', async ({ page }) => {
    await page.goto('/');
    // sanitizeSvgElement throws SANITIZE_ERROR when the root is not <svg> or a
    // <parsererror> exists. Firefox replaces the root with <parsererror>;
    // Chromium/WebKit nest it. Either way the check must trip.
    const tripped = await page.evaluate(() => {
      const doc = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg"><g></svg>', 'image/svg+xml');
      const root = doc.documentElement;
      return !root || root.tagName.toLowerCase() !== 'svg' || doc.querySelector('parsererror') !== null;
    });
    expect(tripped).toBe(true);
  });

  test('AUD-021: mobile export menu opens fully inside the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'PNG export options' }).click();
    const menu = page.locator('#export-menu-png');
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  });
});
