import type { BossId, EnemyDefinition } from '../data/enemies';
import { ELITES, getEnemy } from '../data/enemies';
import { weightedPick, type RandomFn } from '../core/math/random';
import { SpawnBudget } from '../domain/waves/SpawnBudget';
import { WaveDirector } from '../domain/waves/WaveDirector';
import type { WaveDefinition } from '../data/waves';

export interface SpawnUpdateContext {
  elapsedMs: number;
  deltaMs: number;
  activeEnemies: number;
  bossAlive: boolean;
  maxEnemies: number;
  qualityScale: number;
  random: RandomFn;
  spawnEnemy(definition: EnemyDefinition, hpScale: number, damageScale: number): void;
  spawnBoss(id: BossId, hpScale: number, damageScale: number): void;
}

export class SpawnSystem {
  readonly director = new WaveDirector();
  private readonly budget = new SpawnBudget();
  private spawnAccumulator = 0;
  private lastWaveId = 0;

  update(context: SpawnUpdateContext): WaveDefinition | undefined {
    const wave = this.director.getWave(context.elapsedMs);
    this.budget.update(context.deltaMs, wave.budgetPerSec, { maxActive: context.maxEnemies, qualityScale: context.qualityScale });
    this.spawnAccumulator += (context.deltaMs / 1000) * wave.spawnRate * context.qualityScale;
    const pressure = 1 + (context.elapsedMs / 900_000) * 3.1;
    const hpScale = pressure * (context.bossAlive ? 0.84 : 1);
    const damageScale = 0.9 + (context.elapsedMs / 900_000) * 1.05;
    let active = context.activeEnemies;
    let guard = 0;
    while (this.spawnAccumulator >= 1 && active < context.maxEnemies && guard < 12) {
      guard += 1;
      let definition = getEnemy(weightedPick(wave.enemyWeights as Record<string, number>, context.random) as EnemyDefinition['id']);
      if (!context.bossAlive && context.random() < wave.eliteChance && active < context.maxEnemies - 4) {
        definition = ELITES[Math.floor(context.random() * ELITES.length)]!;
      }
      if (!this.budget.canSpend(definition.cost, active, context.maxEnemies)) break;
      this.budget.spend(definition.cost);
      context.spawnEnemy(definition, hpScale * (definition.elite ? 1.2 : 1), damageScale);
      active += 1;
      this.spawnAccumulator -= 1;
    }
    const boss = this.director.takeBossEvent(context.elapsedMs);
    if (boss) context.spawnBoss(boss.id, pressure, damageScale);
    if (wave.id !== this.lastWaveId) {
      this.lastWaveId = wave.id;
      return wave;
    }
    return undefined;
  }
}
