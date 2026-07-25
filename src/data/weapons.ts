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
  { id: 'straight_arrow', name: '노랑 연필', icon: '✏', description: '앞의 적을 빠르게', evolvedName: '샤프 연속쓰기', pattern: 'projectile', passive: 'haste', baseDamage: 12, cooldownMs: 620, range: 720, projectileSpeed: 620, color: 0x8dff94, maxLevel: 5 },
  { id: 'fan_blade', name: '색연필 묶음', icon: '🖍', description: '넓게 여러 적 공격', evolvedName: '무지개 색연필', pattern: 'fan', passive: 'power', baseDamage: 8, cooldownMs: 1_050, range: 620, projectileSpeed: 520, color: 0xffd56b, maxLevel: 5 },
  { id: 'homing_orb', name: '쫓아가는 분필', icon: '○', description: '적을 따라가 공격', evolvedName: '무지개 분필', pattern: 'homing', passive: 'duration', baseDamage: 17, cooldownMs: 1_150, range: 800, projectileSpeed: 320, color: 0xc184ff, maxLevel: 5 },
  { id: 'pierce_spear', name: '긴 자', icon: '📏', description: '여러 적을 곧게 공격', evolvedName: '선생님 긴 자', pattern: 'pierce', passive: 'power', baseDamage: 24, cooldownMs: 1_420, range: 900, projectileSpeed: 760, color: 0x33f2ff, maxLevel: 5 },
  { id: 'boomerang', name: '종이비행기', icon: '✈', description: '날아갔다 돌아옴', evolvedName: '쌍둥이 비행기', pattern: 'boomerang', passive: 'duration', baseDamage: 14, cooldownMs: 1_550, range: 520, projectileSpeed: 420, color: 0xff7e97, maxLevel: 5 },
  { id: 'orbit_blade', name: '회전 지우개', icon: '▰', description: '주변을 돌며 방어', evolvedName: '지우개 방어막', pattern: 'orbit', passive: 'vitality', baseDamage: 10, cooldownMs: 360, range: 86, color: 0x42eaff, maxLevel: 5 },
  { id: 'fire_aura', name: '빨간 사인펜', icon: '🖊', description: '주변 적을 뜨겁게', evolvedName: '선생님 보드마카', pattern: 'aura', passive: 'vitality', baseDamage: 9, cooldownMs: 780, range: 130, color: 0xff7548, maxLevel: 5 },
  { id: 'poison_pool', name: '엎질러진 먹물', icon: '▣', description: '바닥에 먹물 남김', evolvedName: '미술실 먹물통', pattern: 'pool', passive: 'duration', baseDamage: 7, cooldownMs: 2_050, range: 650, color: 0x67e667, maxLevel: 5 },
  { id: 'chain_lightning', name: '형광펜 번개', icon: '▮', description: '적 사이를 이어 공격', evolvedName: '네온 형광펜', pattern: 'chain', passive: 'focus', baseDamage: 13, cooldownMs: 1_350, range: 530, color: 0xe7f7ff, maxLevel: 5 },
  { id: 'frost_nova', name: '물감 팔레트', icon: '🎨', description: '주변 적을 느리게', evolvedName: '얼음 물감통', pattern: 'nova', passive: 'focus', baseDamage: 16, cooldownMs: 2_650, range: 190, color: 0x87d9ff, maxLevel: 5 },
  { id: 'meteor', name: '떨어지는 공책', icon: '📘', description: '먼 곳에 공책 낙하', evolvedName: '공책 소나기', pattern: 'meteor', passive: 'focus', baseDamage: 38, cooldownMs: 3_250, range: 760, color: 0xffa54f, maxLevel: 5 },
  { id: 'laser', name: '레이저 포인터', icon: '●', description: '일직선 적을 관통', evolvedName: '발표실 레이저', pattern: 'beam', passive: 'haste', baseDamage: 28, cooldownMs: 2_150, range: 900, color: 0xff57c8, maxLevel: 5 }
] as const;

export function getWeapon(id: WeaponId): WeaponDefinition {
  return WEAPONS.find((weapon) => weapon.id === id) ?? WEAPONS[0]!;
}
