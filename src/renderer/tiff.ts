/** TIFF 6.0, chunky 8-bit RGB(A), one uncompressed strip, top-left orientation.
 * Canvas pixels have straight alpha: ExtraSamples=2 preserves that convention.
 * https://www.cs.cmu.edu/afs/cs/project/anim/ph/463.96/pub/www/libtiff/TIFF6.pdf
 */
import { DEFAULT_IMAGE_DPI, assertImageDpi } from './imageResolution';

export function encodeTiff(width: number, height: number, rgba: Uint8ClampedArray, transparent: boolean, dpi = DEFAULT_IMAGE_DPI): ArrayBuffer {
  assertImageDpi(dpi);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width * height > 8192 * 8192 || rgba.length !== width * height * 4) {
    throw new Error('TIFF 图像尺寸或像素数据无效。');
  }
  const samples = transparent ? 4 : 3;
  const entries = transparent ? 14 : 13;
  const bitsOffset = 8 + 2 + entries * 12 + 4;
  const resolutionOffset = bitsOffset + samples * 2;
  const pixelsOffset = resolutionOffset + 16;
  const byteCount = width * height * samples;
  const buffer = new ArrayBuffer(pixelsOffset + byteCount), view = new DataView(buffer);
  view.setUint16(0, 0x4949, true); view.setUint16(2, 42, true); view.setUint32(4, 8, true);
  view.setUint16(8, entries, true);
  let cursor = 10;
  const tag = (id: number, type: number, count: number, value: number) => {
    view.setUint16(cursor, id, true); view.setUint16(cursor + 2, type, true);
    view.setUint32(cursor + 4, count, true); view.setUint32(cursor + 8, value, true); cursor += 12;
  };
  tag(256, 4, 1, width); tag(257, 4, 1, height); tag(258, 3, samples, bitsOffset);
  tag(259, 3, 1, 1); tag(262, 3, 1, 2); tag(273, 4, 1, pixelsOffset);
  tag(274, 3, 1, 1); tag(277, 3, 1, samples); tag(278, 4, 1, height);
  tag(279, 4, 1, byteCount); tag(282, 5, 1, resolutionOffset); tag(283, 5, 1, resolutionOffset + 8);
  tag(296, 3, 1, 2);
  if (transparent) tag(338, 3, 1, 2);
  for (let i = 0; i < samples; i++) view.setUint16(bitsOffset + i * 2, 8, true);
  for (let i = 0; i < 2; i++) { view.setUint32(resolutionOffset + i * 8, dpi, true); view.setUint32(resolutionOffset + i * 8 + 4, 1, true); }
  const pixels = new Uint8Array(buffer, pixelsOffset);
  if (transparent) pixels.set(rgba);
  else for (let src = 0, dst = 0; src < rgba.length; src += 4) { pixels[dst++] = rgba[src]; pixels[dst++] = rgba[src + 1]; pixels[dst++] = rgba[src + 2]; }
  return buffer;
}
