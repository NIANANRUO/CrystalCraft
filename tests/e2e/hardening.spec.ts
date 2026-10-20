import { test, expect } from '@playwright/test';
import {importFixture} from './importFixture';
import { readFile } from 'node:fs/promises';

async function importHydrogen(page: any) {
  await page.locator('input[type=file]').setInputFiles({ name: 'hydrogen.xyz', mimeType: 'text/plain', buffer: Buffer.from('2\nRecovery test\nH 0 0 0\nH 0 0 0.74\n') });
  await expect(page.locator('tbody tr')).toHaveCount(2);
}
test('global history, saved project and indexedDB recovery restore structure and visual edits', async ({ page }) => {
  await page.goto('./'); await importFixture(page); await importHydrogen(page);
  await page.keyboard.press('Control+z'); await expect(page.locator('tbody tr')).toHaveCount(4);
  await page.keyboard.press('Control+Shift+z'); await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.keyboard.press('Control+p');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('spinbutton', { name: '原子 Stacks' }).fill('12');
  await dialog.getByRole('spinbutton', { name: '原子 Slices' }).fill('16');
  await dialog.getByRole('spinbutton', { name: '标签 Z 偏移' }).fill('1');
  await dialog.getByRole('spinbutton', { name: '标签 Z 偏移' }).fill('0');
  await dialog.getByRole('spinbutton', { name: '轮廓宽度' }).fill('4');
  await dialog.getByRole('button', { name: 'OK', exact: true }).click();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: '保存项目', exact: true }).click();
  const text = await readFile((await (await download).path())!, 'utf8');
  const project = JSON.parse(text);
  expect(project.version).toBe(2); expect(project.state.structure.atoms).toHaveLength(2);
  expect(project.state.visualSettings).toMatchObject({ atomStacks: 12, atomSlices: 16, labelOffsetZ: 0, outlineWidth: 4 });
  await expect(page.getByText('已自动保存到本机', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole('button', { name: '恢复上次项目' })).toBeVisible();
  await expect(page.getByLabel('空白工作区')).toBeVisible();await expect(page.locator('tbody tr')).toHaveCount(0);
  await page.getByRole('button', { name: '恢复上次项目' }).click(); await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.keyboard.press('Control+p'); await expect(page.getByRole('spinbutton', { name: '原子 Stacks' })).toHaveValue('12');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'broken.crystalcraft.json', mimeType: 'application/json', buffer: Buffer.from(text.replace('"version":2', '"version":9000')) });
  await expect(page.getByRole('alert')).toContainText('版本'); await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.locator('input[type=file]').setInputFiles({ name: 'restored.crystalcraft.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.getByRole('alert')).toHaveCount(0); await expect(page.locator('tbody tr')).toHaveCount(2);
});
test('properties Cancel is a single history transaction and a new edit clears redo', async ({ page }) => {
  await page.goto('./'); await importFixture(page); await importHydrogen(page);
  await page.keyboard.press('Control+p');
  await page.getByRole('spinbutton', { name: '原子 Stacks' }).fill('8');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.keyboard.press('Control+z'); await expect(page.locator('tbody tr')).toHaveCount(4);
  await page.getByRole('button', { name: 'CPK', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('button', { name: /重做 Redo/ })).toBeDisabled();
});
test('500 opaque atoms use custom instanced shaders without errors and rapid file replacement keeps newest result', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('./?showShadows=false');
  const atoms = Array.from({ length: 500 }, (_, i) => `C ${(i % 10) * 2} ${Math.floor(i / 10) % 10 * 2} ${Math.floor(i / 100) * 2}`);
  await page.locator('input[type=file]').setInputFiles({ name: '500.xyz', mimeType: 'text/plain', buffer: Buffer.from(`500\nInstanced\n${atoms.join('\n')}\n`) });
  await expect(page.getByText('500 atoms, 0 bonds, 0 polyhedra', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  const selector = page.locator('select').filter({ has: page.locator('option[value="comic"]') });
  for (const material of ['comic', 'clay', 'handdrawn', 'smooth', 'glass']) {
    await selector.selectOption(material);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await page.screenshot({ path: 'test-results/instanced-500.png' });
  expect(errors).toEqual([]);
  await page.locator('input[type=file]').setInputFiles({ name: 'stale-500.xyz', mimeType: 'text/plain', buffer: Buffer.from(`500\nStale\n${atoms.join('\n')}\n`) });
  await importHydrogen(page);
  await expect(page.getByText('2 atoms, 0 bonds, 0 polyhedra', { exact: true })).toBeVisible();
});

test('idle scenes stop GPU drawing and camera controls invalidate the picture', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).draws = 0;
    for (const name of ['drawElements', 'drawElementsInstanced', 'drawArrays', 'drawArraysInstanced'] as const) {
      const original = WebGL2RenderingContext.prototype[name] as Function;
      (WebGL2RenderingContext.prototype[name] as any) = function (...args: unknown[]) { (window as any).draws++; return original.apply(this, args); };
    }
  });
  await page.goto('./'); await importFixture(page); await expect(page.locator('tbody tr')).toHaveCount(4);
  const idle = await page.evaluate(async () => {
    await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
    const count = (window as any).draws;
    for (let i = 0; i < 30; i++) await new Promise(requestAnimationFrame);
    return { draws: count, idle: (window as any).draws - count };
  });
  expect(idle.draws).toBeGreaterThan(0); expect(idle.idle).toBe(0);
  const before = await page.locator('canvas').first().evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await page.getByRole('button', { name: '↺', exact: true }).click();
  await expect.poll(() => page.locator('canvas').first().evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).not.toBe(before);
});
