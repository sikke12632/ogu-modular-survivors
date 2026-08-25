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
    id: 'guardian', name: '이송희', subtitle: '1학기 회장 · 든든하게 앞을 지켜요',
    description: '지우개 방어 전문가',
    color: 0x33f2ff, accent: 0x147d9c, startingWeapon: 'orbit_blade', startingPassive: 'vitality',
    maxHp: 150, moveSpeed: 210, damageBonus: 1, cooldownBonus: 1, areaBonus: 1.2, armor: 0.12,
    ultimateName: '친구들아, 모여!'
  },
  {
    id: 'ranger', name: '오수아', subtitle: '1학기 부회장 · 누구보다 빠르게 달려요',
    description: '연필 속사 전문가',
    color: 0x6dff78, accent: 0x268f4d, startingWeapon: 'straight_arrow', startingPassive: 'haste',
    maxHp: 125, moveSpeed: 245, damageBonus: 1, cooldownBonus: 0.76, areaBonus: 1, armor: 0.05,
    ultimateName: '연필비가 내린다!'
  },
  {
    id: 'mystic', name: '박서준', subtitle: '1학기 부회장 · 늦게 피는 천재',
    description: '분필 실험 전문가\n레벨업마다 공격력이 자라요',
    color: 0xb26cff, accent: 0x6135a7, startingWeapon: 'homing_orb', startingPassive: 'focus',
    maxHp: 120, moveSpeed: 215, damageBonus: 1.08, cooldownBonus: 1, areaBonus: 1.25, armor: 0.06,
    ultimateName: '과학실 대폭발!'
  }
] as const;

export function getCharacter(id: CharacterId): CharacterDefinition {
  return CHARACTERS.find((character) => character.id === id) ?? CHARACTERS[0]!;
}
