import { defineConfig } from '@playwright/test';

const url = process.env.DEPLOYMENT_URL;
if (!url || !url.startsWith('https://')) throw new Error('请设置 DEPLOYMENT_URL 为实际 HTTPS 站点地址（保留仓库子路径和结尾 /）。');
if (!/^[a-f0-9]{40}$/.test(process.env.EXPECTED_COMMIT ?? '')) throw new Error('请设置 EXPECTED_COMMIT 为预期发布的完整 40 位提交 SHA。');
export default defineConfig({
  testDir: './tests/deployment', workers: 1, timeout: 90_000, retries: 2,
  reporter: [['list'], ['json', { outputFile: 'test-results/deployment.json' }]],
  use: { baseURL: url.endsWith('/') ? url : `${url}/`, channel: process.platform === 'win32' ? 'msedge' : undefined,
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    screenshot: 'only-on-failure', trace: 'retain-on-failure' },
});
