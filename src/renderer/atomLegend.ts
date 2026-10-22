import type { Atom, CrystalStructure } from '../types/crystal';

export interface AtomLegendEntry { element: string; color: string; label: string; atom: Atom }
/** Element overrides and distinct per-atom colors remain separate, including hidden types. */
export function collectAtomLegend(structure: CrystalStructure, colorOf: (atom: Atom) => string): AtomLegendEntry[] {
  const entries = new Map<string, AtomLegendEntry>();
  for (const atom of structure.atoms) {
    const color = colorOf(atom).toUpperCase(), key = `${atom.element}:${color}`;
    if (!entries.has(key)) entries.set(key, { element: atom.element, color, label: atom.element, atom });
  }
  const totals = new Map<string, number>(), counts = new Map<string, number>();
  for (const entry of entries.values()) totals.set(entry.element, (totals.get(entry.element) ?? 0) + 1);
  for (const entry of entries.values()) {
    const index = (counts.get(entry.element) ?? 0) + 1; counts.set(entry.element, index);
    if (totals.get(entry.element)! > 1) entry.label += ` · ${index}`;
  }
  return [...entries.values()];
}

export function planAtomLegend(width: number, height: number, count: number) {
  const fontSize = Math.max(12, Math.round(width / 120));
  const padding = fontSize, sphereSize = fontSize * 3, rowHeight = fontSize * 4;
  const columns = Math.max(1, Math.floor((width - padding * 2) / (fontSize * 14)));
  const cellWidth = (width - padding * 2) / columns;
  const rows = Math.ceil(count / columns), footerHeight = count ? padding * 2 + rows * rowHeight : 0;
  if (footerHeight > height * .4) throw new Error('原子配色种类过多，图例将占用超过 40% 的画幅。请增大画幅高度或关闭原子配色图例。');
  return { fontSize, padding, sphereSize, rowHeight, columns, cellWidth, footerHeight };
}

export function drawAtomLegend(ctx: CanvasRenderingContext2D, width: number, height: number, entries: AtomLegendEntry[], layout: ReturnType<typeof planAtomLegend>, sphere: (entry: AtomLegendEntry) => HTMLCanvasElement) {
  const { fontSize, padding, sphereSize, rowHeight, columns, cellWidth, footerHeight } = layout;
  ctx.save(); ctx.textBaseline = 'middle';
  entries.forEach((entry, index) => {
    const x = padding + index % columns * cellWidth, y = height - footerHeight + padding + Math.floor(index / columns) * rowHeight;
    ctx.drawImage(sphere(entry), x, y, sphereSize, sphereSize);
    const textX = x + sphereSize + fontSize * .5;
    ctx.fillStyle = '#172338'; ctx.font = `600 ${fontSize}px "Segoe UI", "Microsoft YaHei", sans-serif`;
    ctx.fillText(entry.label, textX, y + fontSize * .65, cellWidth - sphereSize - fontSize);
    // This patch is deliberately unlit: its pixels and HEX are the edited base color.
    ctx.fillStyle = entry.color; ctx.fillRect(textX, y + fontSize * 1.55, fontSize * 1.3, fontSize * 1.3);
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = Math.max(1, fontSize / 16);
    ctx.strokeRect(textX, y + fontSize * 1.55, fontSize * 1.3, fontSize * 1.3);
    ctx.fillStyle = '#334155'; ctx.font = `${fontSize * .85}px Consolas, monospace`;
    ctx.fillText(entry.color, textX + fontSize * 1.7, y + fontSize * 2.2);
  });
  ctx.restore();
}
