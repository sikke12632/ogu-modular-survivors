import type { RunState } from '../../../src/domain/run/RunState';
import type { FallbackStorage } from '../../../src/persistence/IndexedDbSaveAdapter';

export function makeRunState(): RunState {
  return {
    seed: 7,
    characterId: 'ranger',
    modeId: 'quick',
    elapsedMs: 0,
    score: 0,
    kills: 0,
    level: 1,
    xp: 0,
    pendingLevelUps: 0,
    ultimate: 0,
    ultimateMax: 200,
    weapons: [{ id: 'straight_arrow', level: 1, evolved: false, cooldownMs: 0 }],
    passives: {},
    bossesDefeated: [],
    stats: {
      maxHp: 100,
      hp: 50,
      moveSpeed: 200,
      damage: 1,
      cooldown: 1,
      area: 1,
      duration: 1,
      pickup: 1,
      armor: 0,
      evasion: 0
    }
  };
}

export function createMemoryStorage(): FallbackStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); }
  };
}
