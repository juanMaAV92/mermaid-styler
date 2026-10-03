import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 20_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4322',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testMatch: /cross-browser-smoke\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testMatch: /cross-browser-smoke\.spec\.ts/,
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'PLAYWRIGHT_PORT=4322 node scripts/serve-static.mjs',
    url: 'http://127.0.0.1:4322',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
