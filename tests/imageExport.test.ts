import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeTiff } from '../src/renderer/tiff';
import { collectAtomLegend, planAtomLegend } from '../src/renderer/atomLegend';
import { CrystalScene } from '../src/renderer/CrystalScene';
import { parseXYZ } from '../src/parsers/xyz';
import { setPngDpi } from '../src/renderer/imageResolution';
import { crc32 } from 'node:zlib';

test('palette includes all elements and distinct edited colors using the scene color precedence', () => {
  const structure = parseXYZ('5\nPalette\nC 0 0 0\nC 1 0 0\nO 2 0 0\nC 3 0 0\nO 4 0 0\n');
  structure.atoms[0].colorOverride = '#123456';
  structure.atoms[3].colorOverride = '#123456';
  const scene: any = Object.create(CrystalScene.prototype);
  scene.visualSettings = { elementColors: { C: '#abcdef', O: '#00ff00' } };
  const legend = collectAtomLegend(structure, atom => scene.getEffectiveAtomColor(atom));
  assert.deepEqual(legend.map(({ label, color }) => [label, color]), [['C · 1', '#123456'], ['C · 2', '#ABCDEF'], ['O', '#00FF00']]);
  delete scene.visualSettings.elementColors.O;
  assert.notEqual(collectAtomLegend(structure, atom => scene.getEffectiveAtomColor(atom))[2].color, '#00FF00');
  assert.equal(structure.atoms[0].colorOverride, '#123456');
});

test('palette wraps without truncation and rejects layouts that would hide the structure', () => {
  const plan = planAtomLegend(1920, 1080, 25);
  assert.ok(plan.columns < 25); assert.ok(plan.footerHeight > plan.rowHeight);
  assert.ok(plan.footerHeight <= 1080 * .4);
  assert.equal(planAtomLegend(1920, 1080, 0).footerHeight, 0);
  assert.throws(() => planAtomLegend(1920, 1080, 2000), /图例/);
});

// Read the public TIFF directory independently, including inline SHORT and RATIONAL fields.
function decode(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  assert.equal(view.getUint16(0, true), 0x4949); assert.equal(view.getUint16(2, true), 42);
  const start = view.getUint32(4, true), count = view.getUint16(start, true), tags = new Map<number, number[]>();
  for (let i = 0; i < count; i++) {
    const entry = start + 2 + i * 12, id = view.getUint16(entry, true), type = view.getUint16(entry + 2, true), n = view.getUint32(entry + 4, true);
    const size = type === 3 ? 2 : type === 5 ? 8 : 4;
    const offset = n * size <= 4 ? entry + 8 : view.getUint32(entry + 8, true);
    tags.set(id, Array.from({ length: n }, (_, index) => type === 3 ? view.getUint16(offset + index * 2, true) : type === 5 ? view.getUint32(offset + index * 8, true) / view.getUint32(offset + index * 8 + 4, true) : view.getUint32(offset + index * 4, true)));
  }
  assert.equal(view.getUint32(start + 2 + count * 12, true), 0);
  const pixelOffset = tags.get(273)![0], size = tags.get(279)![0];
  return { tags, pixels: [...new Uint8Array(buffer, pixelOffset, size)] };
}
test('TIFF independently decodes exact RGB, straight alpha, orientation and default 600 DPI', () => {
  const rgba = new Uint8ClampedArray([18,171,52,255, 170,187,204,128, 1,2,3,0, 240,200,100,255]);
  for (const transparent of [false, true]) {
    const { tags, pixels } = decode(encodeTiff(2, 2, rgba, transparent));
    assert.deepEqual(tags.get(256), [2]); assert.deepEqual(tags.get(257), [2]);
    assert.deepEqual(tags.get(258), transparent ? [8,8,8,8] : [8,8,8]);
    assert.deepEqual(tags.get(259), [1]); assert.deepEqual(tags.get(262), [2]);
    assert.deepEqual(tags.get(274), [1]); assert.deepEqual(tags.get(277), [transparent ? 4 : 3]);
    assert.deepEqual(tags.get(282), [600]); assert.deepEqual(tags.get(283), [600]); assert.deepEqual(tags.get(296), [2]);
    assert.deepEqual(tags.get(338), transparent ? [2] : undefined);
    assert.deepEqual(pixels, transparent ? [...rgba] : [18,171,52,170,187,204,1,2,3,240,200,100]);
  }
  assert.throws(() => encodeTiff(2, 2, new Uint8ClampedArray(4), true), /无效/);
  assert.throws(() => encodeTiff(0, 2, rgba, true), /无效/);
  assert.deepEqual(decode(encodeTiff(2, 2, rgba, true, 1200)).tags.get(282), [1200]);
  assert.throws(() => encodeTiff(2, 2, rgba, true, 0), /DPI/);
});

test('PNG writes valid default 600 DPI metadata, replaces existing DPI and preserves encoded pixels', () => {
  const source = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const buffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  const chunks = (bytes: Uint8Array) => {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), result = new Map<string, Uint8Array[]>();
    for (let offset = 8; offset < bytes.length;) {
      const length = view.getUint32(offset), type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      const list = result.get(type) ?? []; list.push(bytes.subarray(offset, offset + 12 + length)); result.set(type, list);
      offset += length + 12;
    }
    return result;
  };
  const with300 = setPngDpi(buffer, 300), with600 = setPngDpi(with300), parsed = chunks(new Uint8Array(with600));
  assert.equal(parsed.get('pHYs')!.length, 1);
  const metadata = parsed.get('pHYs')![0], view = new DataView(metadata.buffer, metadata.byteOffset, metadata.byteLength);
  assert.equal(view.getUint32(8), 23622); assert.equal(view.getUint32(12), 23622); assert.equal(metadata[16], 1);
  assert.equal(view.getUint32(17), crc32(metadata.subarray(4, 17)));
  assert.deepEqual(parsed.get('IDAT')!.map(bytes => [...bytes]), chunks(source).get('IDAT')!.map(bytes => [...bytes]));
  assert.deepEqual(parsed.get('IHDR')!.map(bytes => [...bytes]), chunks(source).get('IHDR')!.map(bytes => [...bytes]));
  assert.throws(() => setPngDpi(buffer, 0), /DPI/);
  assert.throws(() => setPngDpi(new ArrayBuffer(5)), /文件头/);
});
