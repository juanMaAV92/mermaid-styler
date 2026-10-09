import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test.describe('Cross-browser smoke', () => {
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
    await page.getByRole('button', { name: 'Export PNG' }).click();
    const pngPath = await (await pngDownload).path();
    if (!pngPath) throw new Error('PNG download path is unavailable.');
    expect((await readFile(pngPath)).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

    await editor.fill('flowchart LR\n  A -->');
    await expect(stage).toHaveAttribute('data-render-state', 'error', { timeout: 10_000 });
    await expect(page.locator('[data-svg-host] svg')).toBeVisible();
  });
});
