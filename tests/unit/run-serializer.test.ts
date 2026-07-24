import { describe, expect, it } from 'vitest';
import { getCharacter } from '../../src/data/characters';
import { createRunSnapshot, migrateRunSnapshot } from '../../src/domain/run/RunSerializer';
import { makeRunState } from './fixtures/run';

describe('run snapshot validation', () => {
  it('rejects a current-version boss when any behavior field is missing', () => {
    const state = makeRunState();
    state.activeBoss = {
      id: 'boss_guardian',
      hp: 3_200,
      maxHp: 6_400,
      phase: 2,
      x: 1_000,
      y: 800,
      damage: 20,
      attackCooldownMs: 100,
      specialCooldownMs: 200,
      radialCooldownMs: 300,
      behavior: 'dash',
      behaviorTimerMs: 400,
      dashX: 1,
      dashY: 0,
      slowRemainingMs: 0,
      spawnedAdds: 2
    };
    const snapshot = createRunSnapshot('strict-v2-boss', state);
    delete (snapshot.state.activeBoss as unknown as Record<string, unknown>).behaviorTimerMs;
    expect(migrateRunSnapshot(snapshot)).toBeUndefined();
  });

  it('recalculates derived stats from character and passive levels', () => {
    const state = makeRunState();
    state.passives = { power: 2 };
    state.stats.damage = 999_999;
    const restored = migrateRunSnapshot(createRunSnapshot('derived-stats', state));
    const expectedDamage = getCharacter('ranger').damageBonus * 1.12 * 1.12;
    expect(restored?.state.stats.damage).toBeCloseTo(expectedDamage);
    expect(restored?.state.stats.hp).toBeLessThanOrEqual(restored?.state.stats.maxHp ?? 0);
  });

  it('rejects progression levels above their data-defined maximum', () => {
    const state = makeRunState();
    state.weapons[0]!.level = 99;
    expect(migrateRunSnapshot(createRunSnapshot('invalid-level', state))).toBeUndefined();
  });
});
