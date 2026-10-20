import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {importFixture} from './importFixture';
import { LEGACY_MATERIALS } from '../../src/config';

test('production assets load under a repository path and all 20 materials remain usable', async ({ page }) => {
  // All 20 shaders are compiled in one session on the CI software GPU.
  test.setTimeout(240_000);
  const errors: string[] = [];
  const badResponses: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) badResponses.push(response.url()); });
  await page.goto('./?atomScale=NaN&bondRadius=Infinity&propertiesTab=missing'); await importFixture(page);
  await expect(page.locator('tbody tr')).toHaveCount(4);
  const materialSelector = page.locator('select').filter({ has: page.locator('option[value="comic"]') });
  for (const material of LEGACY_MATERIALS) {
    await materialSelector.selectOption(material);
    await expect(materialSelector).toHaveValue(material);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  for (const name of ['CPK', '线框', '纯棍', '球棍']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await materialSelector.selectOption('comic');
  await page.getByRole('checkbox', { name: '显示结构', exact: true }).uncheck();
  await expect(page.getByRole('checkbox', { name: '显示结构', exact: true })).not.toBeChecked();
  await page.getByRole('checkbox', { name: '显示结构', exact: true }).check();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/desktop.png' });
  expect(errors).toEqual([]);
  expect(badResponses).toEqual([]);
});

test('blank-comment XYZ imports completely; invalid files retain the current structure; export round trip', async ({ page }) => {
  await page.goto('./'); await importFixture(page);
  const input = page.locator('input[type=file]');
  await input.setInputFiles({ name: 'hydrogen.xyz', mimeType: 'text/plain', buffer: Buffer.from('2\n\nH 0 0 0\nH 0 0 0.74\n') });
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await input.setInputFiles({ name: 'broken.xyz', mimeType: 'text/plain', buffer: Buffer.from('3\ntruncated\nH NaN 0 0\n') });
  await expect(page.getByRole('alert')).toContainText('解析失败');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.getByRole('button', { name: 'File', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export XYZ Coordinate File' }).click();
  const file = await downloaded;
  const data = await readFile((await file.path())!, 'utf8');
  expect(data.split(/\r?\n/)[0]).toBe('2');
  await input.setInputFiles({ name: 'roundtrip.xyz', mimeType: 'text/plain', buffer: Buffer.from(data) });
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Ctrl selection survives React synchronization and Cancel restores structural edits', async ({ page }) => {
  await page.goto('./'); await importFixture(page);
  await page.getByRole('button', { name: 'Boundary PBC: ON', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await page.locator('tbody tr').nth(0).click();
  await page.locator('tbody tr').nth(1).click({ modifiers: ['Control'] });
  await expect(page.locator('tbody tr[aria-selected=true]')).toHaveCount(2);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: /Properties - Atoms/ }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Properties' });
  await expect(dialog).toBeVisible();
  const deletion = dialog.getByRole('button', { name: '删除 (空位)', exact: true });
  await deletion.click();
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(4);
});

test('transparent PNG exports at requested size and rendering remains usable', async ({ page }) => {
  await page.goto('./'); await importFixture(page);
  await page.getByRole('button', { name: '渲染图像', exact: true }).click();
  await page.getByRole('button', { name: /3840px.*4K/ }).click();
  await page.getByRole('button', { name: /1920px.*1080p/ }).click();
  await page.getByRole('button', { name: /^Normal/ }).click();
  await page.getByRole('button', { name: '透明通道 (PNG Alpha)', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 PNG 图像', exact: true }).click();
  const result = await downloaded;
  const png = await readFile((await result.path())!);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.readUInt32BE(16)).toBe(1920);
  expect(png.length).toBeGreaterThan(10_000);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('small-screen properties remain inside the viewport and can be dismissed', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./?openProperties=true&propertiesTab=atoms');
  const dialog = page.getByRole('dialog').filter({ hasText: 'Properties' });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(391);
  expect(box!.y + box!.height).toBeLessThanOrEqual(845);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '展开左侧面板', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile.png' });
});

test('unavailable WebGL produces a recoverable message while file operations remain accessible', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type.includes('webgl')) return null;
      return getContext.apply(this, [type, ...args] as never);
    } as typeof getContext;
  });
  await page.goto('./'); await importFixture(page);
  await expect(page.getByText(/无法启动 3D 画布/)).toBeVisible();
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Export XYZ Coordinate File' })).toBeVisible();
});

test('advertised keyboard shortcuts work and leave editable inputs alone', async ({ page }) => {
  await page.goto('./'); await importFixture(page);
  await page.getByRole('button', { name: 'Boundary PBC: ON', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(4);
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Control+o');
  const input = await chooser;
  expect(input.isMultiple()).toBe(false);
  await page.keyboard.press('Control+e');
  await expect(page.getByRole('dialog', { name: /选择目标替换元素/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Control+p');
  await expect(page.getByRole('dialog', { name: 'Structure properties' })).toBeVisible();
  await page.keyboard.press('Escape');
  const rotation = page.getByRole('spinbutton', { name: '旋转步长（度）' });
  await rotation.focus();
  await page.keyboard.press('Control+e');
  await page.keyboard.press('Delete');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await page.getByRole('button', { name: 'Reset', exact: true }).focus();
  await page.keyboard.press('Delete');
  await expect(page.locator('tbody tr')).toHaveCount(3);
});

test('nested Escape only closes the top dialog, and reopened properties use a fresh snapshot', async ({ page }) => {
  await page.goto('./'); await importFixture(page);
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await page.keyboard.press('Control+p');
  const properties = page.getByRole('dialog', { name: 'Structure properties' });
  await properties.getByRole('spinbutton', { name: '原子显示半径' }).fill('0.65');
  await properties.getByRole('button', { name: 'OK', exact: true }).click();
  await page.keyboard.press('Control+p');
  const radius = properties.getByRole('spinbutton', { name: '原子显示半径' });
  await expect(radius).toHaveValue('0.65');
  await radius.fill('0.8');
  await properties.getByRole('button', { name: '周期表替换...', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(properties).toBeVisible();
  await expect(radius).toHaveValue('0.8');
  await page.keyboard.press('Escape');
  await expect(properties).toHaveCount(0);
  await page.keyboard.press('Control+p');
  await expect(radius).toHaveValue('0.65');
});

test('URL-opened properties start empty and imported structure edits can be cancelled', async ({ page }) => {
  await page.goto('./?openProperties=true&propertiesTab=atoms');
  const properties = page.getByRole('dialog', { name: 'Structure properties' });
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await properties.getByRole('button', { name: 'Cancel', exact: true }).click();
  await importFixture(page); await page.keyboard.press('Control+p');
  await properties.getByRole('button', { name: '删除 (空位)', exact: true }).click();
  await expect(page.locator('tbody tr')).not.toHaveCount(4);
  await properties.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(4);
});
