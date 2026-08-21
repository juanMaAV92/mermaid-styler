import { expect, test } from '@playwright/test';

test.describe('Mermaid Styler workbench', () => {
  test('loads the workbench with the expected controls', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('Mermaid Styler');
    await expect(page.getByRole('textbox', { name: 'Paste a Mermaid definition here…' })).toHaveValue(/flowchart LR/);
    await expect(page.getByRole('listbox', { name: 'Diagram presets' }).getByRole('option')).toHaveCount(5);
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
    await expect(page.locator('[data-svg-host] svg')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy SVG' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Export PNG' })).toBeDisabled();
  });

  test('preserves the last valid SVG when the next source is invalid', async ({ page }) => {
    await page.goto('/');
    const editor = page.getByRole('textbox', { name: 'Paste a Mermaid definition here…' });

    await expect(page.locator('[data-svg-host] svg')).toBeVisible();
    await editor.fill('flowchart LR\n  A -->');

    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'error', { timeout: 10_000 });
    await expect(page.locator('[data-svg-host] svg')).toBeVisible();
    await expect(page.locator('[data-state-notice="error"]')).toBeVisible();
    await expect(page.locator('[data-source-feedback]')).toBeVisible();
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
    const editor = page.getByRole('textbox', { name: 'Paste a Mermaid definition here…' });

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
});
