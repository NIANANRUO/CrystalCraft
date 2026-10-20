import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    baseURL: 'http://127.0.0.1:4174/crystal-craft-test/',
    viewport: { width: 1440, height: 1000 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node tests/serve-production.mjs',
    url: 'http://127.0.0.1:4174/crystal-craft-test/',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
