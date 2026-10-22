import { test, expect, type Page } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

async function openExport(page: Page) {
  await page.getByRole('button', { name: '渲染图像', exact: true }).click();
  const dialog = page.getByRole('dialog');
  if (await dialog.getByRole('button', { name: /3840px.*4K/ }).count()) {
    await dialog.getByRole('button', { name: /3840px.*4K/ }).click();
    await dialog.getByRole('button', { name: /1920px.*1080p/ }).click();
  }
  await dialog.getByRole('button', { name: /^Normal/ }).click();
  return dialog;
}

test('PNG and TIFF include exact edited color samples and material balls; transparency and opt-out work', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('./?material=flat&showShadows=false');
  await page.locator('input[type=file]').first().setInputFiles({ name: 'palette.xyz', mimeType: 'text/plain', buffer: Buffer.from('3\nPalette export\nC 0 0 0\nC 1.4 0 0\nO 0 1.5 0\n') });
  await expect(page.locator('tbody tr')).toHaveCount(3);
  const save = page.waitForEvent('download'); await page.getByRole('button', { name: '保存项目', exact: true }).click();
  const project = JSON.parse(await readFile((await (await save).path())!, 'utf8'));
  project.state.structure.atoms[0].colorOverride = '#12ab34';
  project.state.visualSettings.elementColors = { C: '#aabbcc', O: '#1122aa' };
  await page.locator('input[type=file]').first().setInputFiles({ name: 'edited.crystalcraft.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.locator('tbody tr')).toHaveCount(3);
  let dialog = await openExport(page);
  await expect(dialog.getByRole('combobox', { name: '印刷分辨率 DPI' })).toHaveValue('600');
  await expect(dialog.getByRole('checkbox', { name: '包含原子配色图例' })).toBeChecked();
  await dialog.getByRole('button', { name: '透明通道 (PNG Alpha)', exact: true }).click();
  await page.screenshot({ path: 'docs/qa/image-export/export-dialog.png' });
  const pngDownload = page.waitForEvent('download'); await dialog.getByRole('button', { name: '导出 PNG 图像', exact: true }).click();
  const png = await readFile((await (await pngDownload).path())!);
  let ppm = 0;
  for (let offset = 8; offset < png.length;) { const length = png.readUInt32BE(offset); if (png.toString('ascii', offset + 4, offset + 8) === 'pHYs') { ppm = png.readUInt32BE(offset + 8); expect(png[offset + 16]).toBe(1); } offset += length + 12; }
  expect(ppm).toBe(23622);
  const pngPixels = await page.evaluate(async base64 => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = [[18,171,52],[170,187,204],[17,34,170]], counts = colors.map(() => 0);
    for (let i = Math.floor(canvas.height * .8) * canvas.width * 4; i < pixels.length; i += 4) colors.forEach((rgb,j) => { if (rgb.every((n,k) => n === pixels[i+k]) && pixels[i+3] === 255) counts[j]++; });
    return { width: canvas.width, height: canvas.height, cornerAlpha: pixels[3], counts };
  }, png.toString('base64'));
  expect(pngPixels.width).toBe(1920); expect(pngPixels.cornerAlpha).toBe(0);
  pngPixels.counts.forEach(count => expect(count).toBeGreaterThan(200));
  await mkdir('docs/qa/image-export', { recursive: true }); await writeFile('docs/qa/image-export/palette.png', png);

  dialog = await openExport(page); await dialog.getByRole('combobox', { name: '图片格式' }).selectOption('tiff');
  const tiffDownload = page.waitForEvent('download'); await dialog.getByRole('button', { name: '导出 TIFF 图像', exact: true }).click();
  const tiffFile = await tiffDownload, tiff = await readFile((await tiffFile.path())!);
  expect(tiffFile.suggestedFilename()).toMatch(/\.tiff$/); expect(tiff.subarray(0,4)).toEqual(Buffer.from([73,73,42,0]));
  const start = tiff.readUInt32LE(4), tags = new Map<number,number>();
  for (let i = 0; i < tiff.readUInt16LE(start); i++) { const entry = start + 2 + i * 12; tags.set(tiff.readUInt16LE(entry), tiff.readUInt32LE(entry + 8)); }
  expect(tags.get(256)).toBe(1920); expect(tags.get(257)).toBe(pngPixels.height); expect(tags.get(338)).toBe(2);
  expect(tiff.readUInt32LE(tags.get(282)!)).toBe(600); expect(tiff.readUInt32LE(tags.get(283)!)).toBe(600);
  const offset = tags.get(273)!; expect(tiff[offset+3]).toBe(0);
  const counts = [0,0,0], colors = [[18,171,52],[170,187,204],[17,34,170]];
  for (let i = offset + Math.floor(pngPixels.height * .8) * 1920 * 4; i < tiff.length; i += 4) colors.forEach((rgb,j) => { if (rgb.every((n,k) => n === tiff[i+k]) && tiff[i+3] === 255) counts[j]++; });
  counts.forEach(count => expect(count).toBeGreaterThan(200));
  await writeFile('docs/qa/image-export/palette.tiff', tiff);

  dialog = await openExport(page); await dialog.getByRole('checkbox', { name: '包含原子配色图例' }).uncheck();
  await dialog.getByRole('combobox', { name: '印刷分辨率 DPI' }).selectOption('1200');
  await dialog.getByRole('button', { name: '不透明 (纯白底)', exact: true }).click();
  const opaqueDownload = page.waitForEvent('download'); await dialog.getByRole('button', { name: '导出 TIFF 图像', exact: true }).click();
  const opaque = await readFile((await (await opaqueDownload).path())!);
  await writeFile('docs/qa/image-export/opaque-no-legend.tiff', opaque);
  const directory = opaque.readUInt32LE(4); const ids: number[] = [];
  for (let i = 0; i < opaque.readUInt16LE(directory); i++) ids.push(opaque.readUInt16LE(directory+2+i*12));
  expect(ids).not.toContain(338);
  for (let i = 0; i < opaque.readUInt16LE(directory); i++) { const entry = directory+2+i*12; if (opaque.readUInt16LE(entry) === 282) expect(opaque.readUInt32LE(opaque.readUInt32LE(entry + 8))).toBe(1200); }
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0); expect(errors).toEqual([]);
});

test('export options remain reachable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.locator('input[type=file]').first().setInputFiles({ name: 'small.xyz', mimeType: 'text/plain', buffer: Buffer.from('1\nSmall\nC 0 0 0\n') });
  const dialog = await openExport(page);
  await dialog.getByRole('combobox', { name: '图片格式' }).selectOption('tiff');
  await expect(dialog.getByRole('button', { name: '导出 TIFF 图像', exact: true })).toBeInViewport();
  await dialog.getByRole('button', { name: '高级选项', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '导出 TIFF 图像', exact: true })).toBeInViewport();
  await page.screenshot({ path: 'docs/qa/image-export/mobile-dialog.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
