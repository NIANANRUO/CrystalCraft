import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { TEST_LEGACY_SITE_ORDER_CIF, TEST_ROUNDED_HEXAGONAL_CIF, TEST_ROUNDED_PLANAR_CIF } from '../fixtures/cif';

test('CIF worker imports historical site-order metadata and rounded hexagonal positions, then exports complete P1', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('./?showShadows=false');
  await page.getByRole('button', { name: 'Boundary PBC: ON', exact: true }).click();
  const input = page.locator('input[type=file]').first();
  for (const [filename, text, count] of [
    ['legacy.cif', TEST_LEGACY_SITE_ORDER_CIF, 3],
    ['planar.cif', TEST_ROUNDED_PLANAR_CIF, 6],
    ['hexagonal.cif', TEST_ROUNDED_HEXAGONAL_CIF, 12],
  ] as const) {
    await input.setInputFiles({ name: filename, mimeType: 'text/plain', buffer: Buffer.from(text) });
    await expect(page.locator('tbody tr')).toHaveCount(count);
    await expect(page.getByText(new RegExp(`^${count} atoms, \\d+ bonds, 0 polyhedra$`))).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: 'File', exact: true }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CIF File (P1)', exact: true }).click();
    const exported = await readFile((await (await download).path())!, 'utf8');
    expect(exported).toContain("_symmetry_space_group_name_H-M 'P 1'");
    await input.setInputFiles({ name: 'roundtrip.cif', mimeType: 'text/plain', buffer: Buffer.from(exported) });
    await expect(page.locator('tbody tr')).toHaveCount(count);
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await expect(page.getByText('Formula: Zr6Si2N4', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('inconsistent modern and legacy site declarations preserve the previously imported structure', async ({ page }) => {
  await page.goto('./?showShadows=false');
  await page.getByRole('button', { name: 'Boundary PBC: ON', exact: true }).click();
  const input = page.locator('input[type=file]').first();
  await input.setInputFiles({ name: 'valid.cif', mimeType: 'text/plain', buffer: Buffer.from(TEST_ROUNDED_HEXAGONAL_CIF) });
  await expect(page.locator('tbody tr')).toHaveCount(12);
  const invalidLegacy = TEST_LEGACY_SITE_ORDER_CIF.replace('C1 C 1', 'C1 C 3');
  await input.setInputFiles({ name: 'invalid-legacy.cif', mimeType: 'text/plain', buffer: Buffer.from(invalidLegacy) });
  await expect(page.getByRole('alert')).toContainText('均不一致');
  await expect(page.locator('tbody tr')).toHaveCount(12);
  const invalidModern = TEST_LEGACY_SITE_ORDER_CIF.replace('_atom_site_symmetry_multiplicity', '_atom_site_site_symmetry_multiplicity');
  await input.setInputFiles({ name: 'invalid-modern.cif', mimeType: 'text/plain', buffer: Buffer.from(invalidModern) });
  await expect(page.getByRole('alert')).toContainText('位点多重度');
  await expect(page.locator('tbody tr')).toHaveCount(12);
  await input.setInputFiles({ name: 'valid-legacy.cif', mimeType: 'text/plain', buffer: Buffer.from(TEST_LEGACY_SITE_ORDER_CIF) });
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('tbody tr')).toHaveCount(3);
});
