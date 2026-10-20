type Position = { x: number; y: number; z: number };

/** Cartesian cells work for skewed lattices too; exact distance checks remain with callers. */
export class SpatialIndex<T extends { cartesian: Position }> {
  private cells = new Map<string, T[]>();
  constructor(items: T[], private cellSize: number) {
    if (!Number.isFinite(cellSize) || cellSize <= 0) throw new Error('Invalid spatial cell size');
    for (const item of items) {
      const key = this.key(item.cartesian);
      const bucket = this.cells.get(key);
      if (bucket) bucket.push(item);
      else this.cells.set(key, [item]);
    }
  }
  private key(p: Position) {
    if (![p.x, p.y, p.z].every(Number.isFinite)) throw new Error('空间索引坐标必须为有限数值。');
    return `${Math.floor(p.x / this.cellSize)},${Math.floor(p.y / this.cellSize)},${Math.floor(p.z / this.cellSize)}`;
  }
  query(p: Position, radius: number): T[] {
    if (![p.x, p.y, p.z, radius].every(Number.isFinite) || radius < 0) throw new Error('空间查询的坐标和范围必须为有限数值。');
    const min = [p.x, p.y, p.z].map(value => Math.floor((value - radius) / this.cellSize));
    const max = [p.x, p.y, p.z].map(value => Math.floor((value + radius) / this.cellSize));
    if ([...min, ...max].some(value => !Number.isSafeInteger(value)) || max.reduce((count, value, i) => count * (value - min[i] + 1), 1) > 1000000) {
      throw new Error('空间查询范围过大，请降低成键容差后重试。');
    }
    const result: T[] = [];
    for (let x = min[0]; x <= max[0]; x++) {
      for (let y = min[1]; y <= max[1]; y++) {
        for (let z = min[2]; z <= max[2]; z++) {
          const bucket = this.cells.get(`${x},${y},${z}`);
          if (bucket) result.push(...bucket);
        }
      }
    }
    return result;
  }
}
