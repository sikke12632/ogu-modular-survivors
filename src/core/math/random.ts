export type RandomFn = () => number;

export interface StatefulRandomFn extends RandomFn {
  getState(): number;
  setState(state: number): void;
}

export function mulberry32(seed: number, restoredState?: number): StatefulRandomFn {
  let value = (restoredState ?? seed) >>> 0;
  const random = (() => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4_294_967_296;
  }) as StatefulRandomFn;
  random.getState = () => value >>> 0;
  random.setState = (state: number) => { value = state >>> 0; };
  return random;
}

export function weightedPick<T extends string>(weights: Record<T, number>, random: RandomFn): T {
  const entries = Object.entries(weights) as Array<[T, number]>;
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = random() * total;
  for (const [key, weight] of entries) {
    cursor -= weight;
    if (cursor <= 0) return key;
  }
  return entries[entries.length - 1]![0];
}

export function shuffle<T>(items: readonly T[], random: RandomFn): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
  }
  return copy;
}

export function range(random: RandomFn, min: number, max: number): number {
  return min + random() * (max - min);
}
