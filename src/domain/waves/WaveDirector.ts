import { WAVES, type WaveDefinition } from '../../data/waves';

export class WaveDirector {
  private readonly spawnedBosses = new Set<string>();

  getWave(elapsedMs: number): WaveDefinition {
    const seconds = Math.max(0, elapsedMs / 1000);
    return WAVES.find((wave) => seconds >= wave.startSec && seconds < wave.endSec) ?? WAVES[WAVES.length - 1]!;
  }

  takeBossEvent(elapsedMs: number): WaveDefinition['boss'] | undefined {
    const wave = this.getWave(elapsedMs);
    const boss = wave.boss;
    if (!boss || elapsedMs < boss.atSec * 1000 || this.spawnedBosses.has(boss.id)) return undefined;
    this.spawnedBosses.add(boss.id);
    return boss;
  }

  restoreBosses(ids: readonly string[]): void {
    for (const id of ids) this.spawnedBosses.add(id);
  }

  get progress(): number {
    return this.spawnedBosses.size;
  }
}
