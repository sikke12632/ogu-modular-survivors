import type { BossId, EnemyId } from './enemies';

export interface WaveDefinition {
  id: number;
  name: string;
  startSec: number;
  endSec: number;
  spawnRate: number;
  budgetPerSec: number;
  enemyWeights: Partial<Record<EnemyId, number>>;
  eliteChance: number;
  recovery?: boolean;
  boss?: { id: BossId; atSec: number };
}

export const WAVES: readonly WaveDefinition[] = [
  { id: 1, name: '첫 불씨', startSec: 0, endSec: 45, spawnRate: 1.6, budgetPerSec: 2, enemyWeights: { spark: 60, mote: 40 }, eliteChance: 0 },
  { id: 2, name: '빛의 행렬', startSec: 45, endSec: 90, spawnRate: 2.0, budgetPerSec: 2.6, enemyWeights: { spark: 38, mote: 38, wisp: 24 }, eliteChance: 0 },
  { id: 3, name: '빠른 그림자', startSec: 90, endSec: 135, spawnRate: 2.3, budgetPerSec: 3.2, enemyWeights: { spark: 28, mote: 26, wisp: 28, dart: 18 }, eliteChance: 0.005 },
  { id: 4, name: '철갑의 발걸음', startSec: 135, endSec: 180, spawnRate: 2.5, budgetPerSec: 3.8, enemyWeights: { spark: 25, mote: 22, wisp: 22, shell: 20, dart: 11 }, eliteChance: 0.01 },
  { id: 5, name: '회복의 틈', startSec: 180, endSec: 225, spawnRate: 1.75, budgetPerSec: 2.8, enemyWeights: { spark: 35, mote: 35, shell: 12, wisp: 18 }, eliteChance: 0.005, recovery: true },
  { id: 6, name: '포자의 사선', startSec: 225, endSec: 270, spawnRate: 2.8, budgetPerSec: 4.8, enemyWeights: { spark: 19, mote: 19, wisp: 16, shell: 18, shooter_blue: 28 }, eliteChance: 0.015 },
  { id: 7, name: '첫 관문', startSec: 270, endSec: 315, spawnRate: 2.0, budgetPerSec: 3.7, enemyWeights: { spark: 24, mote: 22, shell: 20, shooter_blue: 20, charger: 14 }, eliteChance: 0.01, boss: { id: 'boss_guardian', atSec: 300 } },
  { id: 8, name: '돌진 교차로', startSec: 315, endSec: 360, spawnRate: 3.0, budgetPerSec: 5.7, enemyWeights: { wisp: 20, dart: 17, shell: 15, shooter_blue: 18, charger: 30 }, eliteChance: 0.025 },
  { id: 9, name: '붉은 포화', startSec: 360, endSec: 405, spawnRate: 3.25, budgetPerSec: 6.4, enemyWeights: { spark: 14, dart: 16, shell: 18, shooter_blue: 16, shooter_pink: 22, charger: 14 }, eliteChance: 0.03 },
  { id: 10, name: '파열 지대', startSec: 405, endSec: 450, spawnRate: 3.4, budgetPerSec: 7.2, enemyWeights: { mote: 16, bulwark: 17, shooter_pink: 21, charger: 18, exploder: 28 }, eliteChance: 0.035 },
  { id: 11, name: '숨 고르기', startSec: 450, endSec: 495, spawnRate: 2.25, budgetPerSec: 4.7, enemyWeights: { spark: 22, mote: 22, wisp: 18, shell: 16, shooter_blue: 12, exploder: 10 }, eliteChance: 0.02, recovery: true },
  { id: 12, name: '증폭 회랑', startSec: 495, endSec: 540, spawnRate: 3.55, budgetPerSec: 8.1, enemyWeights: { dart: 14, shell: 16, shooter_blue: 14, shooter_pink: 14, exploder: 16, support: 26 }, eliteChance: 0.045 },
  { id: 13, name: '벽과 탄막', startSec: 540, endSec: 585, spawnRate: 3.7, budgetPerSec: 8.7, enemyWeights: { shell: 12, bulwark: 21, shooter_blue: 17, shooter_pink: 17, support: 13, blocker: 20 }, eliteChance: 0.05 },
  { id: 14, name: '두 번째 관문', startSec: 585, endSec: 630, spawnRate: 2.55, budgetPerSec: 6.2, enemyWeights: { mote: 15, bulwark: 18, shooter_blue: 20, shooter_pink: 20, support: 12, blocker: 15 }, eliteChance: 0.03, boss: { id: 'boss_caster', atSec: 600 } },
  { id: 15, name: '엘리트 러시', startSec: 630, endSec: 675, spawnRate: 3.7, budgetPerSec: 9.8, enemyWeights: { wisp: 12, dart: 12, bulwark: 17, shooter_pink: 15, charger: 14, exploder: 14, support: 8, blocker: 8 }, eliteChance: 0.11 },
  { id: 16, name: '위험 지형', startSec: 675, endSec: 720, spawnRate: 4.1, budgetPerSec: 10.6, enemyWeights: { shell: 12, bulwark: 14, shooter_blue: 15, shooter_pink: 15, charger: 13, exploder: 16, support: 8, blocker: 7 }, eliteChance: 0.07 },
  { id: 17, name: '삼중 포위', startSec: 720, endSec: 765, spawnRate: 4.3, budgetPerSec: 11.2, enemyWeights: { wisp: 13, dart: 13, bulwark: 14, shooter_blue: 13, shooter_pink: 13, charger: 14, exploder: 10, support: 5, blocker: 5 }, eliteChance: 0.08 },
  { id: 18, name: '폭풍 전야', startSec: 765, endSec: 810, spawnRate: 3.0, budgetPerSec: 8.0, enemyWeights: { spark: 15, mote: 15, shell: 16, shooter_blue: 13, charger: 13, exploder: 13, support: 8, blocker: 7 }, eliteChance: 0.045, recovery: true },
  { id: 19, name: '최종 준비', startSec: 810, endSec: 855, spawnRate: 4.45, budgetPerSec: 12.3, enemyWeights: { dart: 12, bulwark: 17, shooter_blue: 14, shooter_pink: 14, charger: 15, exploder: 14, support: 7, blocker: 7 }, eliteChance: 0.09 },
  { id: 20, name: '군주의 강림', startSec: 855, endSec: 900, spawnRate: 3.25, budgetPerSec: 9.5, enemyWeights: { shell: 12, bulwark: 16, shooter_blue: 14, shooter_pink: 14, charger: 15, exploder: 14, support: 8, blocker: 7 }, eliteChance: 0.055, boss: { id: 'boss_overlord', atSec: 870 } }
] as const;
