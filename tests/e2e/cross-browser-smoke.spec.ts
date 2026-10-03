import { expect, test } from '@playwright/test';

test.describe('Cross-browser smoke', () => {
  test('renders a diagram, applies a preset and preserves the last valid artifact', async ({ page }) => {
    await page.goto('/');

    const stage = page.locator('[data-artifact-stage]');
    const editor = page.getByRole('textbox', { name: 'Paste a Mermaid definition here…' });
    await expect(stage).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
    await expect(page.locator('[data-svg-host] svg')).toBeVisible();

    await page.getByRole('option', { name: 'Dark' }).click();
    await expect(page.getByRole('option', { name: 'Dark' })).toHaveAttribute('aria-selected', 'true');
    await expect(stage).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });

    await editor.fill('flowchart LR\n  A -->');
    await expect(stage).toHaveAttribute('data-render-state', 'error', { timeout: 10_000 });
    await expect(page.locator('[data-svg-host] svg')).toBeVisible();
  });
});
