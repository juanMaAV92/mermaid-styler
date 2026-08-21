import { expect, test } from '@playwright/test';

test.describe('Mermaid Styler workbench', () => {
  test('loads the workbench with the expected controls', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('Mermaid Styler');
    await expect(page.getByRole('textbox', { name: 'Paste a Mermaid definition here…' })).toHaveValue(/flowchart LR/);
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

  test('zooms and pans the preview without rerendering the SVG', async ({ page }) => {
    await page.goto('/');
    const viewport = page.locator('[data-preview-viewport]');
    const layer = page.locator('[data-preview-layer]');
    const zoom = page.locator('[data-preview-zoom]');

    await expect(zoom).toHaveText('100%');
    const initialSvg = await page.locator('[data-svg-host] svg').evaluate((svg) => svg.id);

    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(zoom).toHaveText('125%');
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
