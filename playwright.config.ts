import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  fullyParallel: true,
  workers: 2,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_URL || 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-mobile',
      use: { ...devices['iPhone 17 Pro'], browserName: 'chromium', defaultBrowserType: 'chromium' },
    },
    { name: 'webkit-mobile', use: { ...devices['iPhone 17 Pro'], browserName: 'webkit' } },
  ],
  webServer: process.env.E2E_URL
    ? undefined
    : {
        command: 'npm run preview -- --port 4173 --strictPort',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
      },
});
