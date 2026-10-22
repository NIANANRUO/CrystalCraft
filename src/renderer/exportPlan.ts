export interface ExportPlan {
  width: number;
  height: number;
  sampleScale: number;
  renderWidth: number;
  renderHeight: number;
}

export type ImageFormat = 'png' | 'tiff';
export interface ImageExportOptions {
  width: number;
  transparent: boolean;
  quality: 'normal' | 'high' | 'ultra';
  aspectRatio?: 'original' | '16:9' | '4:3' | '1:1';
  format?: ImageFormat;
  includeAtomLegend?: boolean;
  dpi?: number;
}

/** Browser memory hints are coarse, so these remain conservative allocation caps. */
export function exportPixelBudget(deviceMemory?: number): number {
  const megapixels = deviceMemory === undefined || !Number.isFinite(deviceMemory) ? 32 : deviceMemory <= 2 ? 8 : deviceMemory <= 4 ? 16 : 64;
  return megapixels * 1024 * 1024;
}

export function planImageExport(width: number, aspect: number, quality: 'normal' | 'high' | 'ultra', maxDimension: number, maxPixels = 8192 * 8192): ExportPlan {
  if (!Number.isFinite(width) || !Number.isFinite(aspect) || width < 1 || width > 8192 || aspect <= 0) {
    throw new Error('导出宽度须为 1–8192 像素，纵横比须为正数。');
  }
  if (!Number.isFinite(maxDimension) || maxDimension < 1 || !Number.isFinite(maxPixels) || maxPixels < 1) {
    throw new Error('无法确定当前设备的图像导出能力，请重新初始化画布后重试。');
  }
  if (!['normal', 'high', 'ultra'].includes(quality)) throw new Error('未知的图像导出质量。');
  width = Math.round(width);
  const height = Math.max(1, Math.round(width / aspect));
  // Preserve every preset including 8K square; decline unsupported output instead of silently cropping.
  if (width > maxDimension || height > maxDimension || width * height > Math.min(maxPixels, 8192 * 8192)) {
    throw new Error(`当前设备无法导出 ${width} × ${height} 图像。请降低分辨率或选择 16:9 / 4:3 比例。`);
  }
  const requested = quality === 'ultra' ? 4 : quality === 'high' ? 2 : 1;
  const samplePixels = Math.max(width * height, Math.min(maxPixels, 16 * 1024 * 1024));
  const sampleScale = Math.max(1, Math.min(requested, Math.floor(maxDimension / width), Math.floor(maxDimension / height), Math.floor(Math.sqrt(samplePixels / (width * height)))));
  return { width, height, sampleScale, renderWidth: width * sampleScale, renderHeight: height * sampleScale };
}
