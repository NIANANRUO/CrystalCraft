import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function loadXYZ(page: Page) {
  await page.goto('./?showShadows=false');
  await page.locator('input[type=file]').first().setInputFiles({ name: 'bond-editor.xyz', mimeType: 'text/plain',
    buffer: Buffer.from('4\nBond editor QA\nC 0 0 0\nC 1.4 0 0\nN 4 0 0\nN 5.4 0 0\n') });
  await expect(page.getByText('4 atoms, 2 bonds, 0 polyhedra', { exact: true })).toHaveCount(1);
}
async function openBonds(page: Page) {
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'Bonds... (化学键规则)', exact: true }).click();
  return page.getByRole('dialog', { name: 'Structure properties' });
}
const counts = (page: Page, atoms: number, bonds: number) => expect(page.getByText(`${atoms} atoms, ${bonds} bonds, 0 polyhedra`, { exact: true })).toHaveCount(1);

test('bond rules edit real counts; Apply/Cancel, save, undo and redo preserve the transaction', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await loadXYZ(page);
  let dialog = await openBonds(page);
  const table = () => dialog.getByRole('table', { name: '化学键规则列表' });
  await expect(table().locator('tbody tr')).toHaveCount(3);
  await dialog.getByRole('spinbutton', { name: '最大键长 Max. length (Å)' }).fill('1.3');
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await counts(page, 4, 1);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await counts(page, 4, 2);

  dialog = await openBonds(page);
  await expect(dialog.getByRole('checkbox', { name: '按规则成键 (Use bond rules)' })).not.toBeChecked();
  await dialog.getByRole('button', { name: 'New', exact: true }).click();
  await expect(table().locator('tbody tr')).toHaveCount(4);
  await dialog.getByRole('combobox', { name: '成键原子 A2' }).selectOption('N');
  await dialog.getByRole('spinbutton', { name: '最小键长 Min. length (Å)' }).fill('2.5');
  await expect(dialog.getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
  await dialog.getByRole('spinbutton', { name: '最大键长 Max. length (Å)' }).fill('2.7');
  await dialog.getByRole('button', { name: '上移规则' }).click();
  await expect(table().locator('tbody tr').nth(2)).toContainText('2.7');
  await dialog.getByRole('button', { name: '下移规则' }).click();
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await counts(page, 4, 3);
  await page.screenshot({ path: 'docs/qa/bonds/desktop.png' });
  await dialog.getByRole('button', { name: 'OK', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存项目', exact: true }).click();
  const saved = await readFile((await (await download).path())!, 'utf8');
  expect(JSON.parse(saved).state.visualSettings.bondSettings).toMatchObject({ enabled: true, rules: expect.arrayContaining([
    expect.objectContaining({ atom1: 'C', atom2: 'N', minLength: 2.5, maxLength: 2.7 })
  ]) });
  await page.keyboard.press('Control+z'); await counts(page, 4, 2);
  await page.keyboard.press('Control+Shift+z'); await counts(page, 4, 3);
  dialog = await openBonds(page);
  await dialog.getByRole('button', { name: 'Clear', exact: true }).click();
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await counts(page, 4, 0);
  await page.keyboard.press('Escape'); await counts(page, 4, 3);
  await page.locator('input[type=file]').first().setInputFiles({ name: 'saved.crystalcraft.json', mimeType: 'application/json', buffer: Buffer.from(saved) });
  await counts(page, 4, 3);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.locator('input[type=file]').first().setInputFiles({ name: 'new-oxygen.xyz', mimeType: 'text/plain',
    buffer: Buffer.from('2\nNew structure\nO 0 0 0\nO 1.2 0 0\n') });
  await counts(page, 2, 1);
  dialog = await openBonds(page);
  await expect(dialog.getByRole('checkbox', { name: '按规则成键 (Use bond rules)' })).not.toBeChecked();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(errors).toEqual([]);
});

test('boundary modes 1, 2 and 3 produce distinct periodic completions', async ({ page }) => {
  await page.goto('./?showShadows=false');
  await page.locator('input[type=file]').first().setInputFiles({ name: 'boundary.vasp', mimeType: 'text/plain', buffer: Buffer.from(
    'Boundary QA\n1\n10 0 0\n0 10 0\n0 0 10\nC N\n1 1\nDirect\n.95 .5 .5\n.05 .5 .5\n') });
  const dialog = await openBonds(page);
  await dialog.getByRole('checkbox', { name: '周期边界补全', exact: true }).check();
  await dialog.getByRole('button', { name: 'Clear', exact: true }).click();
  await dialog.getByRole('button', { name: 'New', exact: true }).click();
  await dialog.getByRole('combobox', { name: '成键原子 A2' }).selectOption('N');
  await dialog.getByRole('spinbutton', { name: '最大键长 Max. length (Å)' }).fill('1.1');
  await dialog.getByRole('radio', { name: /Do not search atoms beyond/ }).check();
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await counts(page, 2, 0);
  await dialog.getByRole('radio', { name: /if A1 is included/ }).check();
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await counts(page, 3, 1);
  await dialog.getByRole('radio', { name: /recursively/ }).check();
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await counts(page, 4, 2);
  await dialog.getByRole('checkbox', { name: '周期边界补全', exact: true }).uncheck(); await counts(page, 2, 0);
  await dialog.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('narrow-screen editor validates input, supports labels, wildcard modes and keyboard row selection', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 844 });
  await loadXYZ(page);
  const dialog = await openBonds(page);
  await dialog.getByRole('checkbox', { name: 'Search by label', exact: true }).check();
  await dialog.getByRole('combobox', { name: '成键原子 A1' }).selectOption('C1');
  await dialog.getByRole('combobox', { name: '成键原子 A2' }).selectOption('C2');
  await dialog.getByRole('spinbutton', { name: '最大键长 Max. length (Å)' }).fill('');
  await expect(dialog.getByRole('alert')).toContainText('键长');
  await expect(dialog.getByRole('button', { name: 'OK', exact: true })).toBeDisabled();
  await dialog.getByRole('spinbutton', { name: '最大键长 Max. length (Å)' }).fill('1.5');
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await counts(page, 4, 2);
  const rows = dialog.getByRole('table', { name: '化学键规则列表' }).locator('tbody tr');
  await rows.first().focus(); await page.keyboard.press('ArrowDown');
  await expect(rows.nth(1)).toBeFocused(); await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true');
  await dialog.getByRole('radio', { name: 'Search atoms bonded to A1', exact: true }).check();
  await expect(dialog.getByRole('combobox', { name: '成键原子 A2' })).toBeDisabled();
  await dialog.getByRole('radio', { name: 'Search molecules', exact: true }).check();
  await expect(dialog.getByRole('combobox', { name: '成键原子 A1' })).toBeDisabled();
  await expect(dialog.getByRole('checkbox', { name: 'Show polyhedra', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click(); await expect(rows).toHaveCount(2);
  await dialog.getByRole('button', { name: '自动生成', exact: true }).click(); await expect(rows).toHaveCount(3);
  const bounds = await dialog.boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  await page.screenshot({ path: 'docs/qa/bonds/mobile.png' });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await counts(page, 4, 2);
});
