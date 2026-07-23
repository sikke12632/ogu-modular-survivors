export type EnemyRole = 'chaser' | 'runner' | 'tank' | 'shooter' | 'charger' | 'exploder' | 'support' | 'blocker';
export type EnemyId = 'spark' | 'mote' | 'wisp' | 'dart' | 'shell' | 'bulwark' | 'shooter_blue' | 'shooter_pink' | 'charger' | 'exploder' | 'support' | 'blocker';
export type EliteId = 'elite_charge' | 'elite_barrage' | 'elite_leech' | 'elite_summon';
export type BossId = 'boss_guardian' | 'boss_caster' | 'boss_overlord';

export interface EnemyDefinition {
  id: EnemyId | EliteId | BossId;
  name: string;
  role: EnemyRole;
  hp: number;
  speed: number;
  damage: number;
  xp: number;
  cost: number;
  radius: number;
  color: number;
  accent: number;
  ranged?: boolean;
  elite?: boolean;
  boss?: boolean;
}

export const ENEMIES: readonly EnemyDefinition[] = [
  { id: 'spark', name: '붉은 불씨', role: 'chaser', hp: 18, speed: 96, damage: 10, xp: 4, cost: 1, radius: 14, color: 0xff5d73, accent: 0xffb0bb },
  { id: 'mote', name: '푸른 티끌', role: 'chaser', hp: 22, speed: 86, damage: 11, xp: 4, cost: 1, radius: 15, color: 0x42d9ff, accent: 0xbdefff },
  { id: 'wisp', name: '빛살 도깨비', role: 'runner', hp: 12, speed: 168, damage: 9, xp: 4, cost: 2, radius: 11, color: 0xe9ff6a, accent: 0xffffff },
  { id: 'dart', name: '분홍 쐐기', role: 'runner', hp: 15, speed: 150, damage: 10, xp: 5, cost: 2, radius: 12, color: 0xff72ce, accent: 0xffd7f1 },
  { id: 'shell', name: '철갑 구체', role: 'tank', hp: 72, speed: 56, damage: 17, xp: 10, cost: 4, radius: 21, color: 0x6d7d98, accent: 0xe4f0ff },
  { id: 'bulwark', name: '수정 방벽', role: 'tank', hp: 94, speed: 48, damage: 20, xp: 12, cost: 5, radius: 24, color: 0x7262c9, accent: 0xdad1ff },
  { id: 'shooter_blue', name: '청색 포자', role: 'shooter', hp: 32, speed: 72, damage: 12, xp: 8, cost: 3, radius: 16, color: 0x48b8ff, accent: 0xd7f3ff, ranged: true },
  { id: 'shooter_pink', name: '홍색 포자', role: 'shooter', hp: 38, speed: 66, damage: 14, xp: 9, cost: 3, radius: 17, color: 0xff5cb0, accent: 0xffd0e8, ranged: true },
  { id: 'charger', name: '돌진 뿔', role: 'charger', hp: 50, speed: 80, damage: 22, xp: 10, cost: 4, radius: 18, color: 0xff8a42, accent: 0xffe1b9 },
  { id: 'exploder', name: '파열 핵', role: 'exploder', hp: 36, speed: 92, damage: 25, xp: 9, cost: 4, radius: 17, color: 0xff384e, accent: 0xffd65b },
  { id: 'support', name: '증폭 정령', role: 'support', hp: 42, speed: 64, damage: 8, xp: 12, cost: 5, radius: 18, color: 0x65ffa0, accent: 0xe1ffe9 },
  { id: 'blocker', name: '길막 기둥', role: 'blocker', hp: 120, speed: 40, damage: 18, xp: 14, cost: 6, radius: 27, color: 0x8d6e63, accent: 0xffe0b2 }
] as const;

export const ELITES: readonly EnemyDefinition[] = [
  { id: 'elite_charge', name: '폭주 첨병', role: 'charger', hp: 520, speed: 105, damage: 28, xp: 60, cost: 12, radius: 27, color: 0xff633f, accent: 0xffe35f, elite: true },
  { id: 'elite_barrage', name: '탄막 사제', role: 'shooter', hp: 470, speed: 68, damage: 18, xp: 65, cost: 12, radius: 27, color: 0xd65cff, accent: 0xf4d6ff, ranged: true, elite: true },
  { id: 'elite_leech', name: '흡수 포식자', role: 'tank', hp: 680, speed: 62, damage: 22, xp: 70, cost: 12, radius: 30, color: 0xff477e, accent: 0x8c1a46, elite: true },
  { id: 'elite_summon', name: '무리 조율자', role: 'support', hp: 560, speed: 58, damage: 16, xp: 75, cost: 12, radius: 29, color: 0x4dffd2, accent: 0x196c64, elite: true }
] as const;

export const BOSSES: readonly EnemyDefinition[] = [
  { id: 'boss_guardian', name: '돌진 수호자', role: 'charger', hp: 6_400, speed: 70, damage: 32, xp: 320, cost: 99, radius: 52, color: 0xff7247, accent: 0xffd66d, boss: true },
  { id: 'boss_caster', name: '탄막 술사', role: 'shooter', hp: 11_500, speed: 56, damage: 25, xp: 460, cost: 99, radius: 55, color: 0xa45cff, accent: 0x59dfff, ranged: true, boss: true },
  { id: 'boss_overlord', name: '최종 군주', role: 'charger', hp: 23_000, speed: 68, damage: 38, xp: 800, cost: 99, radius: 64, color: 0xff3d86, accent: 0x6c5cff, boss: true }
] as const;

const ALL = [...ENEMIES, ...ELITES, ...BOSSES] as const;
export function getEnemy(id: EnemyDefinition['id']): EnemyDefinition {
  return ALL.find((enemy) => enemy.id === id) ?? ENEMIES[0]!;
}
