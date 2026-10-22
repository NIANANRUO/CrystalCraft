import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('HTTPS first load, reload, local import, and data/image downloads', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  await page.goto('./');
  const manifest = await page.request.get('./build-info.json');
  expect(manifest.ok()).toBeTruthy();
  const info = await manifest.json();
  expect(info.name).toBe('crystal-craft-web'); expect(info.version).toMatch(/^\d+\.\d+\.\d+$/);
  expect(info.commit).toBe(process.env.EXPECTED_COMMIT);
  expect(info.sourceDirty).toBe(false);
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', /script-src 'self';/);
  expect(Object.keys(info.assets).length).toBeGreaterThan(0);
  expect(info.files['index.html']).toMatch(/^[a-f0-9]{64}$/);
  for (const [path, expectedHash] of Object.entries(info.files)) {
    expect(path).toMatch(/^(?:index\.html|LICENSE\.txt|THIRD_PARTY_NOTICES\.txt|assets\/[A-Za-z0-9_.-]+\.(?:js|css))$/);
    const response = await page.request.get(`./${path}`);
    expect(response.ok()).toBeTruthy();
    expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(expectedHash);
  }
  await expect(page.getByLabel('空白工作区')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('空白工作区')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await page.locator('input[type=file]').setInputFiles({ name: 'acceptance.xyz', mimeType: 'text/plain', buffer: Buffer.from('2\nHTTPS acceptance\nH 0 0 0\nH 0 0 0.74\n') });
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.getByRole('button', { name: 'File', exact: true }).click();
  const dataDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export XYZ Coordinate File' }).click();
  expect(await readFile((await (await dataDownload).path())!, 'utf8')).toContain('H');
  await page.getByRole('button', { name: '渲染图像', exact: true }).click();
  await page.getByRole('button', { name: /3840px.*4K/ }).click();
  await page.getByRole('button', { name: /1920px.*1080p/ }).click();
  await page.getByRole('button', { name: /^Normal/ }).click();
  const imageDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 PNG 图像', exact: true }).click();
  const png = await readFile((await (await imageDownload).path())!);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.readUInt32BE(16)).toBe(1920);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(failures).toEqual([]);
});
