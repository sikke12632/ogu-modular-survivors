import type { PassiveId } from './passives';
import type { WeaponId } from './weapons';

export type CharacterId = 'guardian' | 'ranger' | 'mystic';

export interface CharacterDefinition {
  id: CharacterId;
  name: string;
  subtitle: string;
  description: string;
  color: number;
  accent: number;
  startingWeapon: WeaponId;
  startingPassive: PassiveId;
  maxHp: number;
  moveSpeed: number;
  damageBonus: number;
  cooldownBonus: number;
  areaBonus: number;
  armor: number;
  ultimateName: string;
}

export const CHARACTERS: readonly CharacterDefinition[] = [
  {
    id: 'guardian', name: '수호자', subtitle: '버티며 밀어붙이는 선봉',
    description: '높은 체력과 방어. 회전 검과 오라 범위 +20%.',
    color: 0x33f2ff, accent: 0x147d9c, startingWeapon: 'orbit_blade', startingPassive: 'vitality',
    maxHp: 150, moveSpeed: 210, damageBonus: 1, cooldownBonus: 1, areaBonus: 1.2, armor: 0.12,
    ultimateName: '수호 폭발'
  },
  {
    id: 'ranger', name: '사수', subtitle: '빠른 탄막을 만드는 추적자',
    description: '이동과 연사 우세. 투사체 공격속도 +16%.',
    color: 0x6dff78, accent: 0x268f4d, startingWeapon: 'straight_arrow', startingPassive: 'haste',
    maxHp: 110, moveSpeed: 245, damageBonus: 1, cooldownBonus: 0.84, areaBonus: 1, armor: 0.03,
    ultimateName: '별빛 일제사격'
  },
  {
    id: 'mystic', name: '술사', subtitle: '전장을 접어 제어하는 연구자',
    description: '범위와 상태 이상 우세. 모든 효과 범위 +25%.',
    color: 0xb26cff, accent: 0x6135a7, startingWeapon: 'homing_orb', startingPassive: 'focus',
    maxHp: 100, moveSpeed: 200, damageBonus: 1.08, cooldownBonus: 1, areaBonus: 1.25, armor: 0.02,
    ultimateName: '중력 붕괴'
  }
] as const;

export function getCharacter(id: CharacterId): CharacterDefinition {
  return CHARACTERS.find((character) => character.id === id) ?? CHARACTERS[0]!;
}
