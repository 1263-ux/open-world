import { defineConfig } from '@playwright/test';
// No server, no browser-sandbox weakening: exercise the extracted file directly.
export default defineConfig({
  testDir: '../../tests/e2e', testMatch: 'offline-file.spec.ts', workers: 1, retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'offline-playwright-report' }]],
  use: { viewport: { width: 1440, height: 960 }, trace: 'retain-on-failure', screenshot: 'only-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  timeout: 30000,
});
