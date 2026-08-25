import { getCharacter, type CharacterId } from '../../data/characters';
import type { PassiveId } from '../../data/passives';
import type { RunStats } from './RunState';

// 대기만성(서준/mystic) 전용: 레벨이 오를수록 공격력이 복리로 자란다.
// 세이브 복원(calculateRunStats)과 인게임 레벨업 양쪽에서 같은 공식을 써야
// 이어하기 후에도 수치가 일치한다.
export const MYSTIC_LEVEL_DAMAGE_GROWTH = 1.02;

export function levelDamageScale(characterId: CharacterId, level: number): number {
  if (characterId !== 'mystic') return 1;
  return Math.pow(MYSTIC_LEVEL_DAMAGE_GROWTH, Math.max(0, Math.floor(level) - 1));
}

export function createBaseRunStats(characterId: CharacterId): RunStats {
  const character = getCharacter(characterId);
  return {
    maxHp: character.maxHp,
    hp: character.maxHp,
    moveSpeed: character.moveSpeed,
    damage: character.damageBonus,
    cooldown: character.cooldownBonus,
    area: character.areaBonus,
    duration: 1,
    pickup: 1,
    armor: character.armor,
    evasion: 0
  };
}

export function applyPassiveStatBonus(stats: RunStats, passiveId: PassiveId): void {
  if (passiveId === 'vitality') {
    const gain = stats.maxHp * 0.15;
    stats.maxHp += gain;
    stats.hp = Math.min(stats.maxHp, stats.hp + gain);
  } else if (passiveId === 'power') stats.damage *= 1.12;
  else if (passiveId === 'haste') stats.cooldown *= 0.92;
  else if (passiveId === 'focus') stats.area *= 1.12;
  else if (passiveId === 'duration') stats.duration *= 1.12;
  else if (passiveId === 'stride') stats.moveSpeed *= 1.08;
  else if (passiveId === 'magnet') stats.pickup *= 1.22;
  else if (passiveId === 'guard') {
    stats.armor = Math.min(0.55, stats.armor + 0.05);
    stats.evasion = Math.min(0.35, stats.evasion + 0.02);
  }
}

export function calculateRunStats(
  characterId: CharacterId,
  passives: Partial<Record<PassiveId, number>>,
  currentHp?: number,
  level = 1
): RunStats {
  const stats = createBaseRunStats(characterId);
  for (const [passiveId, passiveLevel] of Object.entries(passives) as Array<[PassiveId, number]>) {
    for (let index = 0; index < passiveLevel; index += 1) applyPassiveStatBonus(stats, passiveId);
  }
  stats.damage *= levelDamageScale(characterId, level);
  if (currentHp !== undefined) stats.hp = Math.max(0, Math.min(stats.maxHp, currentHp));
  return stats;
}
