import { expect, test } from '@playwright/test';

test.describe('Leave-page guard', () => {
  test('AUD-020: reloading after editing the source asks for confirmation', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
    await page.getByRole('textbox', { name: 'Source' }).fill('flowchart LR\n  X --> Y');

    const dialogPromise = page.waitForEvent('dialog');
    const reload = page.reload();
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('beforeunload');
    await dialog.accept();
    await reload;
  });

  test('AUD-020: reloading an untouched sample or a source restored to the sample shows no dialog', async ({ page }) => {
    let dialogs = 0;
    page.on('dialog', (dialog) => { dialogs += 1; void dialog.accept(); });
    await page.goto('/');
    await expect(page.locator('[data-artifact-stage]')).toHaveAttribute('data-render-state', 'ready', { timeout: 10_000 });
    const source = page.getByRole('textbox', { name: 'Source' });
    await page.reload();
    expect(dialogs).toBe(0);

    const sample = await source.inputValue();
    await source.fill('flowchart LR\n  X --> Y');
    await source.fill(sample);
    await page.reload();
    expect(dialogs).toBe(0);
  });
});
