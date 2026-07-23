import type { PassiveId } from './passives';

export type WeaponId =
  | 'straight_arrow' | 'fan_blade' | 'homing_orb' | 'pierce_spear'
  | 'boomerang' | 'orbit_blade' | 'fire_aura' | 'poison_pool'
  | 'chain_lightning' | 'frost_nova' | 'meteor' | 'laser';

export type WeaponPattern = 'projectile' | 'fan' | 'homing' | 'pierce' | 'boomerang' | 'orbit' | 'aura' | 'pool' | 'chain' | 'nova' | 'meteor' | 'beam';

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  icon: string;
  description: string;
  evolvedName: string;
  pattern: WeaponPattern;
  passive: PassiveId;
  baseDamage: number;
  cooldownMs: number;
  range: number;
  projectileSpeed?: number;
  color: number;
  maxLevel: number;
}

export const WEAPONS: readonly WeaponDefinition[] = [
  { id: 'straight_arrow', name: '직선 화살', icon: '➵', description: '가장 가까운 적에게 빠른 화살', evolvedName: '혜성 연사', pattern: 'projectile', passive: 'haste', baseDamage: 12, cooldownMs: 620, range: 720, projectileSpeed: 620, color: 0x8dff94, maxLevel: 5 },
  { id: 'fan_blade', name: '부채꼴 칼날', icon: '✦', description: '넓게 퍼지는 다중 칼날', evolvedName: '천개 칼날', pattern: 'fan', passive: 'power', baseDamage: 8, cooldownMs: 1_050, range: 620, projectileSpeed: 520, color: 0xffd56b, maxLevel: 5 },
  { id: 'homing_orb', name: '유도 구슬', icon: '●', description: '목표를 추적하는 마력 구슬', evolvedName: '별의 사냥개', pattern: 'homing', passive: 'duration', baseDamage: 17, cooldownMs: 1_150, range: 800, projectileSpeed: 320, color: 0xc184ff, maxLevel: 5 },
  { id: 'pierce_spear', name: '관통 창', icon: '⇢', description: '일렬로 적을 꿰뚫는 창', evolvedName: '무한 궤도창', pattern: 'pierce', passive: 'power', baseDamage: 24, cooldownMs: 1_420, range: 900, projectileSpeed: 760, color: 0x33f2ff, maxLevel: 5 },
  { id: 'boomerang', name: '왕복 부메랑', icon: '↶', description: '나갔다 돌아오며 두 번 타격', evolvedName: '쌍월 회귀', pattern: 'boomerang', passive: 'duration', baseDamage: 14, cooldownMs: 1_550, range: 520, projectileSpeed: 420, color: 0xff7e97, maxLevel: 5 },
  { id: 'orbit_blade', name: '회전 검', icon: '⟳', description: '몸 주변을 도는 수호의 검', evolvedName: '행성 방벽', pattern: 'orbit', passive: 'vitality', baseDamage: 10, cooldownMs: 360, range: 86, color: 0x42eaff, maxLevel: 5 },
  { id: 'fire_aura', name: '화염 오라', icon: '♨', description: '주변 적을 주기적으로 태움', evolvedName: '태양의 심장', pattern: 'aura', passive: 'vitality', baseDamage: 9, cooldownMs: 780, range: 130, color: 0xff7548, maxLevel: 5 },
  { id: 'poison_pool', name: '독 장판', icon: '◉', description: '적의 발밑에 지속 피해 구역', evolvedName: '심해 오염', pattern: 'pool', passive: 'duration', baseDamage: 7, cooldownMs: 2_050, range: 650, color: 0x67e667, maxLevel: 5 },
  { id: 'chain_lightning', name: '연쇄 번개', icon: 'ϟ', description: '가까운 적 사이를 연쇄 타격', evolvedName: '폭풍 회로', pattern: 'chain', passive: 'focus', baseDamage: 13, cooldownMs: 1_350, range: 530, color: 0xe7f7ff, maxLevel: 5 },
  { id: 'frost_nova', name: '얼음 폭발', icon: '❄', description: '주변을 얼려 느리게 만듦', evolvedName: '절대 영점', pattern: 'nova', passive: 'focus', baseDamage: 16, cooldownMs: 2_650, range: 190, color: 0x87d9ff, maxLevel: 5 },
  { id: 'meteor', name: '메테오', icon: '☄', description: '표시된 위치에 강력한 낙하 공격', evolvedName: '유성우', pattern: 'meteor', passive: 'focus', baseDamage: 38, cooldownMs: 3_250, range: 760, color: 0xffa54f, maxLevel: 5 },
  { id: 'laser', name: '직선 레이저', icon: '━', description: '적을 가르는 즉발 광선', evolvedName: '오로라 절단선', pattern: 'beam', passive: 'haste', baseDamage: 28, cooldownMs: 2_150, range: 900, color: 0xff57c8, maxLevel: 5 }
] as const;

export function getWeapon(id: WeaponId): WeaponDefinition {
  return WEAPONS.find((weapon) => weapon.id === id) ?? WEAPONS[0]!;
}
