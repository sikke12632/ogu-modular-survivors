import type { CharacterId } from '../../data/characters';
import type { PassiveId } from '../../data/passives';
import type { WeaponId } from '../../data/weapons';
import type { BossId } from '../../data/enemies';

export interface OwnedWeapon {
  id: WeaponId;
  level: number;
  evolved: boolean;
  cooldownMs: number;
}

export interface RunStats {
  maxHp: number;
  hp: number;
  moveSpeed: number;
  damage: number;
  cooldown: number;
  area: number;
  duration: number;
  pickup: number;
  armor: number;
  evasion: number;
}

export interface RunState {
  seed: number;
  characterId: CharacterId;
  elapsedMs: number;
  score: number;
  kills: number;
  level: number;
  xp: number;
  pendingLevelUps: number;
  ultimate: number;
  ultimateMax: number;
  weapons: OwnedWeapon[];
  passives: Partial<Record<PassiveId, number>>;
  stats: RunStats;
  bossesDefeated: string[];
  activeBoss?: { id: BossId; hp: number; maxHp: number; phase: number };
}
