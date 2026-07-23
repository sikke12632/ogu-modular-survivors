export interface SpatialEntry {
  uid: number;
  x: number;
  y: number;
  active: boolean;
}

export class SpatialHashGrid<T extends SpatialEntry> {
  private readonly cells = new Map<string, T[]>();

  constructor(private readonly cellSize = 160) {}

  clear(): void {
    this.cells.clear();
  }

  insert(item: T): void {
    const key = this.key(item.x, item.y);
    const bucket = this.cells.get(key);
    if (bucket) bucket.push(item);
    else this.cells.set(key, [item]);
  }

  rebuild(items: Iterable<T>): void {
    this.clear();
    for (const item of items) if (item.active) this.insert(item);
  }

  queryRadius(x: number, y: number, radius: number): T[] {
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minY = Math.floor((y - radius) / this.cellSize);
    const maxY = Math.floor((y + radius) / this.cellSize);
    const radiusSq = radius * radius;
    const result: T[] = [];
    const seen = new Set<number>();
    for (let cx = minX; cx <= maxX; cx += 1) {
      for (let cy = minY; cy <= maxY; cy += 1) {
        const bucket = this.cells.get(`${cx}:${cy}`);
        if (!bucket) continue;
        for (const item of bucket) {
          if (!item.active || seen.has(item.uid)) continue;
          const dx = item.x - x;
          const dy = item.y - y;
          if (dx * dx + dy * dy <= radiusSq) {
            seen.add(item.uid);
            result.push(item);
          }
        }
      }
    }
    return result;
  }

  private key(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)}:${Math.floor(y / this.cellSize)}`;
  }
}
