export const DEFAULT_IMAGE_DPI = 600;
export function assertImageDpi(dpi: number) {
  if (!Number.isInteger(dpi) || dpi < 72 || dpi > 2400) throw new Error('图像 DPI 必须为 72–2400 的整数。');
}
/** Replace native canvas resolution with a standard PNG pHYs chunk. Pixel data is untouched. */
export function setPngDpi(source: ArrayBuffer, dpi = DEFAULT_IMAGE_DPI): ArrayBuffer {
  assertImageDpi(dpi);
  const data = new Uint8Array(source), view = new DataView(source);
  if (data.length < 33 || ![137,80,78,71,13,10,26,10].every((value, i) => data[i] === value)) throw new Error('PNG 文件头无效。');
  const parts: Uint8Array[] = [data.subarray(0, 8)];
  const chunk = new Uint8Array(21), chunkView = new DataView(chunk.buffer);
  chunkView.setUint32(0, 9); chunk.set([112,72,89,115], 4);
  const pixelsPerMeter = Math.round(dpi / .0254);
  chunkView.setUint32(8, pixelsPerMeter); chunkView.setUint32(12, pixelsPerMeter); chunk[16] = 1;
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, 17)) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  chunkView.setUint32(17, (crc ^ 0xffffffff) >>> 0);
  let inserted = false, ended = false;
  for (let offset = 8; offset < data.length;) {
    if (offset + 12 > data.length) throw new Error('PNG 数据被截断。');
    const length = view.getUint32(offset), end = offset + 12 + length;
    if (end > data.length) throw new Error('PNG 数据被截断。');
    const type = String.fromCharCode(...data.subarray(offset + 4, offset + 8));
    if (offset === 8 && (type !== 'IHDR' || length !== 13)) throw new Error('PNG 缺少有效的尺寸信息。');
    if (type !== 'pHYs') parts.push(data.subarray(offset, end));
    if (type === 'IHDR' && !inserted) { parts.push(chunk); inserted = true; }
    if (type === 'IEND') { ended = true; break; }
    offset = end;
  }
  if (!inserted || !ended) throw new Error('PNG 数据不完整。');
  const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output.buffer;
}
