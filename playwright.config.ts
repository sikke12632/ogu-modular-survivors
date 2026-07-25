import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:4188', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm preview --port 4188 --strictPort',
    port: 4188,
    reuseExistingServer: false
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'], isMobile: true, hasTouch: true } }
  ]
});
