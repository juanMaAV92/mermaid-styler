import type { Page } from '@playwright/test';

/** Accept any dialog (e.g. beforeunload) so reloads and navigations never hang a test. */
export const acceptDialogs = (page: Page) => {
  page.on('dialog', (dialog) => { void dialog.accept(); });
};
