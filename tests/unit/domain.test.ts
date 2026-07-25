import { describe, expect, it } from 'vitest';
import { SAVE_SCHEMA_VERSION } from '../../src/app/version';
import { SpatialHashGrid } from '../../src/core/math/SpatialHashGrid';
import { mulberry32 } from '../../src/core/math/random';
import { resolveDamage } from '../../src/domain/combat/DamageResolver';
import { tickEnemyCooldowns, tryConsumeEnemyCooldown } from '../../src/domain/combat/EnemyCooldowns';
import { getRunMode } from '../../src/data/runModes';
import { applyExperience, xpRequiredForLevel } from '../../src/domain/progression/Experience';
import { applyTreasureReward, decideChestSpawn } from '../../src/domain/progression/TreasureReward';
import { applyUpgradeChoice, draftUpgrades, findEvolutionCandidate } from '../../src/domain/progression/UpgradeDraft';
import { createRunSnapshot, migrateRunSnapshot, type RunSnapshot } from '../../src/domain/run/RunSerializer';
import type { RunState } from '../../src/domain/run/RunState';
import { SpawnBudget } from '../../src/domain/waves/SpawnBudget';
import { WaveDirector } from '../../src/domain/waves/WaveDirector';
import { ComboSystem } from '../../src/systems/ComboSystem';
import { PerformanceSystem } from '../../src/systems/PerformanceSystem';
import { SpawnSystem } from '../../src/systems/SpawnSystem';
import { MissionService } from '../../src/domain/missions/MissionService';
import { IndexedDbSaveAdapter, type AsyncKeyValueStore, type FallbackStorage } from '../../src/persistence/IndexedDbSaveAdapter';

function makeState(): RunState {
  return {
    seed: 7, characterId: 'ranger', modeId: 'quick', elapsedMs: 0, score: 0, kills: 0, level: 1, xp: 0,
    pendingLevelUps: 0, ultimate: 0, ultimateMax: 200,
    weapons: [{ id: 'straight_arrow', level: 1, evolved: false, cooldownMs: 0 }],
    passives: {}, bossesDefeated: [],
    stats: { maxHp: 100, hp: 50, moveSpeed: 200, damage: 1, cooldown: 1, area: 1, duration: 1, pickup: 1, armor: 0, evasion: 0 }
  };
}

describe('core combat and progression', () => {
  it('reduces damage by armor and clamps to a useful minimum', () => {
    expect(resolveDamage({ amount: 100, armor: 0.25, criticalChance: 0, random: () => 1 }).amount).toBe(75);
    expect(resolveDamage({ amount: 0, armor: 0.8, criticalChance: 0, random: () => 1 }).amount).toBe(1);
  });

  it('carries overflow XP across multiple levels', () => {
    const gain = xpRequiredForLevel(1) + xpRequiredForLevel(2) + 5;
    expect(applyExperience(1, 0, gain)).toEqual({ level: 3, xp: 5, levelsGained: 2 });
  });

  it('drafts three legal, deterministic upgrade choices', () => {
    const choices = draftUpgrades(makeState(), mulberry32(123), 3);
    expect(choices).toHaveLength(3);
    expect(new Set(choices.map((choice) => `${choice.kind}:${choice.id}`)).size).toBe(3);
  });

  it('applies passives and recognizes an evolution recipe', () => {
    const state = makeState();
    applyUpgradeChoice(state, { kind: 'passive', id: 'haste', title: '', description: '', icon: '', isNew: true });
    expect(state.stats.cooldown).toBeCloseTo(0.92);
    state.weapons[0]!.level = 5;
    expect(findEvolutionCandidate(state.weapons, state.passives)?.id).toBe('straight_arrow');
  });

  it('applies a compressed upgrade as three progression steps', () => {
    const state = makeState();
    applyUpgradeChoice(state, { kind: 'weapon', id: 'straight_arrow', title: '', description: '', icon: '', isNew: false }, 3);
    expect(state.weapons[0]!.level).toBe(4);
    applyUpgradeChoice(state, { kind: 'passive', id: 'power', title: '', description: '', icon: '', isNew: true }, 3);
    expect(state.passives.power).toBe(3);
    expect(state.stats.damage).toBeCloseTo(1.12 ** 3);
  });

  it('keeps normal shots and radial specials on independent cooldowns', () => {
    const cooldowns = { attackCooldownMs: 0, specialCooldownMs: 0, radialCooldownMs: 0 };
    expect(tryConsumeEnemyCooldown(cooldowns, 'attackCooldownMs', 1_200)).toBe(true);
    expect(tryConsumeEnemyCooldown(cooldowns, 'radialCooldownMs', 2_000)).toBe(true);
    expect(cooldowns).toEqual({ attackCooldownMs: 1_200, specialCooldownMs: 0, radialCooldownMs: 2_000 });
    tickEnemyCooldowns(cooldowns, 1_500);
    expect(tryConsumeEnemyCooldown(cooldowns, 'attackCooldownMs', 1_200)).toBe(true);
    expect(tryConsumeEnemyCooldown(cooldowns, 'radialCooldownMs', 2_000)).toBe(false);
  });

  it('allows evolution only from a boss chest', () => {
    const state = makeState();
    applyUpgradeChoice(state, { kind: 'passive', id: 'haste', title: '', description: '', icon: '', isNew: true });
    state.weapons[0]!.level = 5;
    expect(applyTreasureReward(state, false, () => 0).evolved).toBe(false);
    expect(state.weapons[0]!.evolved).toBe(false);
    expect(applyTreasureReward(state, true, () => 0).evolved).toBe(true);
    expect(state.weapons[0]!.evolved).toBe(true);
  });

  it('replaces a normal chest when a boss chest is requested', () => {
    expect(decideChestSpawn([], false)).toBe('spawn');
    expect(decideChestSpawn([false], false)).toBe('skip');
    expect(decideChestSpawn([false], true)).toBe('replace-normal');
    expect(decideChestSpawn([true], true)).toBe('skip');
  });
});

describe('waves, budgets, saves, and spatial lookup', () => {
  it('compresses the original timeline into dense 5 and 10 minute modes', () => {
    expect(getRunMode('quick')).toMatchObject({
      durationMs: 300_000,
      timelineScale: 3,
      spawnDensity: 3,
      upgradeSteps: 3
    });
    expect(getRunMode('focus')).toMatchObject({
      durationMs: 600_000,
      timelineScale: 1.5,
      spawnDensity: 1.5,
      upgradeSteps: 3
    });
  });

  it('has a stable 20-wave timeline and one-shot boss events', () => {
    const director = new WaveDirector();
    expect(director.getWave(0).id).toBe(1);
    expect(director.getWave(899_000).id).toBe(20);
    expect(director.takeBossEvent(299_000)).toBeUndefined();
    expect(director.takeBossEvent(300_000)?.id).toBe('boss_guardian');
    expect(director.takeBossEvent(301_000)).toBeUndefined();
  });

  it('restores an active boss as already spawned and resets for a new run', () => {
    const director = new WaveDirector();
    director.restore({ defeatedBosses: [], activeBossId: 'boss_caster' });
    expect(director.takeBossEvent(600_000)).toBeUndefined();
    director.reset();
    expect(director.takeBossEvent(600_000)?.id).toBe('boss_caster');
  });

  it('does not overspend spawn credit', () => {
    const budget = new SpawnBudget();
    for (let index = 0; index < 4; index += 1) budget.update(250, 8, { maxActive: 100, qualityScale: 1 });
    expect(budget.spend(5)).toBe(true);
    expect(budget.spend(5)).toBe(false);
    expect(budget.canSpend(2, 100, 100)).toBe(false);
  });

  it('resets all stateful run systems for a deterministic retry', () => {
    const combo = new ComboSystem();
    combo.registerKill();
    combo.reset();
    expect(combo.count).toBe(0);

    const performance = new PerformanceSystem();
    for (let index = 0; index < 4; index += 1) performance.update(1_000);
    expect(performance.quality).toBe('medium');
    performance.reset();
    expect({ quality: performance.quality, maxEnemies: performance.maxEnemies, effectsScale: performance.effectsScale })
      .toEqual({ quality: 'high', maxEnemies: 230, effectsScale: 1 });

    const spawn = new SpawnSystem();
    const bosses: string[] = [];
    const updateAtBoss = () => spawn.update({
      elapsedMs: 300_000,
      deltaMs: 16,
      activeEnemies: 230,
      bossAlive: false,
      maxEnemies: 230,
      qualityScale: 1,
      random: () => 0.5,
      spawnEnemy: () => undefined,
      spawnBoss: (id) => bosses.push(id)
    });
    updateAtBoss();
    updateAtBoss();
    expect(bosses).toEqual(['boss_guardian']);
    spawn.reset();
    updateAtBoss();
    expect(bosses).toEqual(['boss_guardian', 'boss_guardian']);
  });

  it('rejects unknown save schema versions', () => {
    expect(migrateRunSnapshot({ schemaVersion: 999, state: makeState(), runId: 'x' })).toBeUndefined();
  });

  it('migrates a v1 run into a validated v2 checkpoint', () => {
    const state = makeState();
    state.activeBoss = {
      id: 'boss_guardian',
      hp: 3_200,
      maxHp: 6_400,
      phase: 2
    } as RunState['activeBoss'];
    const migrated = migrateRunSnapshot({
      schemaVersion: 1,
      gameVersion: '0.1.0',
      savedAt: 100,
      runId: 'legacy',
      state
    });
    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated?.checkpoint.player).toEqual({ x: 1_280, y: 800 });
    expect(migrated?.checkpoint.spawn.spawnedBosses).toContain('boss_guardian');
    expect(migrated?.state.activeBoss?.behavior).toBe('chase');
  });

  it('rejects a corrupt current checkpoint instead of trusting its shape', () => {
    const snapshot = createRunSnapshot('bad-checkpoint', makeState());
    snapshot.checkpoint.combo.remainingMs = Number.NaN;
    expect(migrateRunSnapshot(snapshot)).toBeUndefined();
  });

  it('restores random, mission, combo, and spawn generator state', () => {
    const random = mulberry32(123);
    random();
    const randomState = random.getState();
    const expectedNext = random();
    expect(mulberry32(999, randomState)()).toBe(expectedNext);

    const mission = new MissionService(() => 0);
    mission.update(18_000, 18_000);
    mission.record('kill');
    const restoredMission = new MissionService(() => 1);
    restoredMission.restore(mission.snapshot());
    expect(restoredMission.snapshot()).toEqual(mission.snapshot());

    const combo = new ComboSystem();
    combo.registerKill();
    combo.registerKill();
    combo.update(800);
    const restoredCombo = new ComboSystem();
    restoredCombo.restore(combo.snapshot());
    expect(restoredCombo.snapshot()).toEqual(combo.snapshot());

    const spawn = new SpawnSystem();
    spawn.restoreBossProgress(['boss_guardian'], 'boss_caster');
    const restoredSpawn = new SpawnSystem();
    restoredSpawn.restore(spawn.snapshot());
    expect(restoredSpawn.snapshot()).toEqual(spawn.snapshot());
  });

  it('queries only nearby active objects without duplicates', () => {
    const grid = new SpatialHashGrid<{ uid: number; x: number; y: number; active: boolean }>(100);
    grid.rebuild([{ uid: 1, x: 30, y: 30, active: true }, { uid: 2, x: 350, y: 30, active: true }, { uid: 3, x: 40, y: 40, active: false }]);
    expect(grid.queryRadius(0, 0, 80).map((item) => item.uid)).toEqual([1]);
  });
});

describe('checkpoint persistence', () => {
  it('serializes overlapping autosaves in request order', async () => {
    const order: string[] = [];
    let releaseFirst!: () => void;
    let markFirstStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => { markFirstStarted = resolve; });
    const release = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const store: AsyncKeyValueStore = {
      get: async () => undefined,
      set: async (_key, value) => {
        const snapshot = value as RunSnapshot;
        if (snapshot.runId === 'first') {
          markFirstStarted();
          await release;
        }
        order.push(snapshot.runId);
      },
      delete: async () => undefined
    };
    const adapter = new IndexedDbSaveAdapter(store, createMemoryStorage());
    const first = adapter.saveRun(createRunSnapshot('first', makeState()));
    const second = adapter.saveRun(createRunSnapshot('second', makeState()));
    await firstStarted;
    expect(order).toEqual([]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(['first', 'second']);
  });

  it('uses a validated local fallback when IndexedDB fails', async () => {
    const failedStore: AsyncKeyValueStore = {
      get: async () => { throw new Error('blocked'); },
      set: async () => { throw new Error('blocked'); },
      delete: async () => { throw new Error('blocked'); }
    };
    const fallback = createMemoryStorage();
    const adapter = new IndexedDbSaveAdapter(failedStore, fallback);
    await adapter.saveRun(createRunSnapshot('fallback', makeState()));
    expect((await adapter.loadRun())?.runId).toBe('fallback');
  });
});

function createMemoryStorage(): FallbackStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); }
  };
}
