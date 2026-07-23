export class ObjectPool<T> {
  private readonly available: T[] = [];
  private readonly created = new Set<T>();

  constructor(
    private readonly factory: () => T,
    private readonly reset: (item: T) => void,
    private readonly maxSize: number
  ) {}

  acquire(): T | undefined {
    const reused = this.available.pop();
    if (reused) return reused;
    if (this.created.size >= this.maxSize) return undefined;
    const item = this.factory();
    this.created.add(item);
    return item;
  }

  release(item: T): void {
    if (!this.created.has(item) || this.available.includes(item)) return;
    this.reset(item);
    this.available.push(item);
  }

  get size(): number { return this.created.size; }
  get free(): number { return this.available.length; }
}
