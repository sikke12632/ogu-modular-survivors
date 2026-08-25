import { GAME_VERSION, SAVE_SCHEMA_VERSION } from '../../app/version';
import { CHARACTERS } from '../../data/characters';
import { BOSSES, type BossId } from '../../data/enemies';
import { PASSIVES } from '../../data/passives';
import { DEFAULT_RUN_MODE_ID, isRunModeId } from '../../data/runModes';
import { WEAPONS } from '../../data/weapons';
import type { ActiveMission, MissionType } from '../missions/MissionService';
import type { ActiveBossState, RunState, RunStats } from './RunState';
import { calculateRunStats } from './RunStatsCalculator';

const DEFAULT_PLAYER_X = 1_280;
const DEFAULT_PLAYER_Y = 800;
const CHARACTER_IDS = new Set<string>(CHARACTERS.map((entry) => entry.id));
const WEAPON_IDS = new Set<string>(WEAPONS.map((entry) => entry.id));
const PASSIVE_IDS = new Set<string>(PASSIVES.map((entry) => entry.id));
const BOSS_IDS = new Set<string>(BOSSES.map((entry) => entry.id));
const WEAPON_MAX_LEVELS = new Map<string, number>(WEAPONS.map((entry) => [entry.id, entry.maxLevel]));
const PASSIVE_MAX_LEVELS = new Map<string, number>(PASSIVES.map((entry) => [entry.id, entry.maxLevel]));
const MISSION_TYPES = new Set<MissionType>(['kills', 'survive', 'noHit', 'collect', 'elite']);
const BOSS_BEHAVIORS = new Set<ActiveBossState['behavior']>(['chase', 'telegraph', 'dash', 'recover']);

export interface ImportantPickupState {
  x: number;
  y: number;
  value: number;
  bossChest: boolean;
}

export interface SpawnCheckpointState {
  spawnAccumulator: number;
  lastWaveId: number;
  budgetCredit: number;
  spawnedBosses: string[];
}

export interface MissionCheckpointState {
  cooldownMs: number;
  active?: ActiveMission;
}

export interface ComboCheckpointState {
  count: number;
  remainingMs: number;
  awardedAssemble: boolean;
}

export interface RunCheckpoint {
  player: { x: number; y: number };
  spawn: SpawnCheckpointState;
  mission: MissionCheckpointState;
  combo: ComboCheckpointState;
  importantPickups: ImportantPickupState[];
  randomState: number;
  timers: {
    chestMs: number;
    assembleMs: number;
    assembleFireMs: number;
  };
}

export interface RunSnapshot {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  gameVersion: string;
  savedAt: number;
  runId: string;
  state: RunState;
  checkpoint: RunCheckpoint;
}

export function createDefaultCheckpoint(state: RunState): RunCheckpoint {
  return {
    player: { x: DEFAULT_PLAYER_X, y: DEFAULT_PLAYER_Y },
    spawn: {
      spawnAccumulator: 0,
      lastWaveId: 0,
      budgetCredit: 0,
      spawnedBosses: [...state.bossesDefeated, ...(state.activeBoss ? [state.activeBoss.id] : [])]
    },
    mission: { cooldownMs: 18_000 },
    combo: { count: 0, remainingMs: 0, awardedAssemble: false },
    importantPickups: [],
    randomState: (state.seed + Math.floor(state.elapsedMs)) >>> 0,
    timers: { chestMs: 38_000, assembleMs: 0, assembleFireMs: 0 }
  };
}

export function createRunSnapshot(runId: string, state: RunState, checkpoint = createDefaultCheckpoint(state)): RunSnapshot {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    gameVersion: GAME_VERSION,
    savedAt: Date.now(),
    runId,
    state: structuredClone(state),
    checkpoint: structuredClone(checkpoint)
  };
}

export function migrateRunSnapshot(value: unknown): RunSnapshot | undefined {
  if (!isRecord(value) || (value.schemaVersion !== 1 && value.schemaVersion !== SAVE_SCHEMA_VERSION)) return undefined;
  if (typeof value.runId !== 'string' || value.runId.length === 0) return undefined;
  const sourceSchemaVersion = value.schemaVersion;
  const state = migrateRunState(value.state, sourceSchemaVersion);
  if (!state) return undefined;

  const checkpoint = value.schemaVersion === 1
    ? createDefaultCheckpoint(state)
    : migrateCheckpoint(value.checkpoint);
  if (!checkpoint) return undefined;

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    gameVersion: typeof value.gameVersion === 'string' ? value.gameVersion : GAME_VERSION,
    savedAt: isFiniteNumber(value.savedAt) ? value.savedAt : Date.now(),
    runId: value.runId,
    state,
    checkpoint
  };
}

function migrateRunState(value: unknown, sourceSchemaVersion: 1 | typeof SAVE_SCHEMA_VERSION): RunState | undefined {
  if (!isRecord(value)
    || !CHARACTER_IDS.has(String(value.characterId))
    || !isFiniteNumber(value.seed)
    || !isNonNegativeNumber(value.elapsedMs)
    || !isNonNegativeNumber(value.score)
    || !isNonNegativeNumber(value.kills)
    || !isPositiveNumber(value.level)
    || !isNonNegativeNumber(value.xp)
    || !isNonNegativeNumber(value.pendingLevelUps)
    || !isNonNegativeNumber(value.ultimate)
    || !isPositiveNumber(value.ultimateMax)
    || !Array.isArray(value.weapons)
    || !isRecord(value.passives)
    || !isRunStats(value.stats)
    || !Array.isArray(value.bossesDefeated)) return undefined;

  const weapons = value.weapons.map((weapon) => {
    const weaponId = isRecord(weapon) ? String(weapon.id) : '';
    if (!isRecord(weapon)
      || !WEAPON_IDS.has(weaponId)
      || !isPositiveNumber(weapon.level)
      || weapon.level > (WEAPON_MAX_LEVELS.get(weaponId) ?? 0)
      || typeof weapon.evolved !== 'boolean'
      || !isFiniteNumber(weapon.cooldownMs)) return undefined;
    return {
      id: weaponId as RunState['weapons'][number]['id'],
      level: Math.floor(weapon.level),
      evolved: weapon.evolved,
      cooldownMs: weapon.cooldownMs
    };
  });
  if (weapons.some((weapon) => !weapon)) return undefined;

  const passives: RunState['passives'] = {};
  for (const [id, level] of Object.entries(value.passives)) {
    if (!PASSIVE_IDS.has(id)
      || !isPositiveNumber(level)
      || level > (PASSIVE_MAX_LEVELS.get(id) ?? 0)) return undefined;
    passives[id as keyof RunState['passives']] = Math.floor(level);
  }

  const bossesDefeated = value.bossesDefeated.map(String);
  if (bossesDefeated.some((id) => !BOSS_IDS.has(id))) return undefined;
  const activeBoss = value.activeBoss === undefined
    ? undefined
    : migrateActiveBoss(value.activeBoss, sourceSchemaVersion);
  if (value.activeBoss !== undefined && !activeBoss) return undefined;
  const characterId = String(value.characterId) as RunState['characterId'];
  const modeId = isRunModeId(value.modeId) ? value.modeId : DEFAULT_RUN_MODE_ID;
  const stats = calculateRunStats(characterId, passives, value.stats.hp, Math.floor(value.level));

  return {
    seed: value.seed,
    characterId,
    modeId,
    elapsedMs: value.elapsedMs,
    score: value.score,
    kills: Math.floor(value.kills),
    level: Math.floor(value.level),
    xp: value.xp,
    pendingLevelUps: Math.floor(value.pendingLevelUps),
    ultimate: Math.min(value.ultimate, value.ultimateMax),
    ultimateMax: value.ultimateMax,
    weapons: weapons as RunState['weapons'],
    passives,
    stats,
    bossesDefeated,
    activeBoss
  };
}

function migrateActiveBoss(
  value: unknown,
  sourceSchemaVersion: 1 | typeof SAVE_SCHEMA_VERSION
): ActiveBossState | undefined {
  if (!isRecord(value)
    || !BOSS_IDS.has(String(value.id))
    || !isNonNegativeNumber(value.hp)
    || !isPositiveNumber(value.maxHp)
    || !isPositiveNumber(value.phase)) return undefined;
  const hasBehavior = isFiniteNumber(value.x)
    && isFiniteNumber(value.y)
    && isPositiveNumber(value.damage)
    && isFiniteNumber(value.attackCooldownMs)
    && isFiniteNumber(value.specialCooldownMs)
    && isFiniteNumber(value.radialCooldownMs)
    && BOSS_BEHAVIORS.has(value.behavior as ActiveBossState['behavior'])
    && isFiniteNumber(value.behaviorTimerMs)
    && isFiniteNumber(value.dashX)
    && isFiniteNumber(value.dashY)
    && isNonNegativeNumber(value.slowRemainingMs)
    && isNonNegativeNumber(value.spawnedAdds);
  if (sourceSchemaVersion === SAVE_SCHEMA_VERSION && !hasBehavior) return undefined;

  return {
    id: String(value.id) as BossId,
    hp: Math.min(value.hp, value.maxHp),
    maxHp: value.maxHp,
    phase: Math.max(1, Math.min(3, Math.floor(value.phase))),
    x: hasBehavior ? value.x as number : DEFAULT_PLAYER_X + 700,
    y: hasBehavior ? value.y as number : DEFAULT_PLAYER_Y,
    damage: hasBehavior ? value.damage as number : BOSSES.find((boss) => boss.id === value.id)!.damage,
    attackCooldownMs: hasBehavior ? Math.max(0, value.attackCooldownMs as number) : 0,
    specialCooldownMs: hasBehavior ? Math.max(0, value.specialCooldownMs as number) : 0,
    radialCooldownMs: hasBehavior ? Math.max(0, value.radialCooldownMs as number) : 0,
    behavior: hasBehavior ? value.behavior as ActiveBossState['behavior'] : 'chase',
    behaviorTimerMs: hasBehavior ? Math.max(0, value.behaviorTimerMs as number) : 0,
    dashX: hasBehavior ? value.dashX as number : 0,
    dashY: hasBehavior ? value.dashY as number : 0,
    slowRemainingMs: hasBehavior ? value.slowRemainingMs as number : 0,
    spawnedAdds: hasBehavior ? Math.floor(value.spawnedAdds as number) : 0
  };
}

function migrateCheckpoint(value: unknown): RunCheckpoint | undefined {
  if (!isRecord(value)
    || !isPoint(value.player)
    || !isSpawnState(value.spawn)
    || !isMissionState(value.mission)
    || !isComboState(value.combo)
    || !Array.isArray(value.importantPickups)
    || !isFiniteNumber(value.randomState)
    || !isRecord(value.timers)
    || !isNonNegativeNumber(value.timers.chestMs)
    || !isNonNegativeNumber(value.timers.assembleMs)
    || !isNonNegativeNumber(value.timers.assembleFireMs)) return undefined;

  const importantPickups = value.importantPickups.map((pickup) => {
    if (!isRecord(pickup)
      || !isFiniteNumber(pickup.x)
      || !isFiniteNumber(pickup.y)
      || !isPositiveNumber(pickup.value)
      || typeof pickup.bossChest !== 'boolean') return undefined;
    return { x: pickup.x, y: pickup.y, value: pickup.value, bossChest: pickup.bossChest };
  });
  if (importantPickups.some((pickup) => !pickup)) return undefined;

  return {
    player: { x: value.player.x, y: value.player.y },
    spawn: structuredClone(value.spawn) as SpawnCheckpointState,
    mission: structuredClone(value.mission) as MissionCheckpointState,
    combo: structuredClone(value.combo) as ComboCheckpointState,
    importantPickups: importantPickups as ImportantPickupState[],
    randomState: value.randomState >>> 0,
    timers: {
      chestMs: value.timers.chestMs,
      assembleMs: value.timers.assembleMs,
      assembleFireMs: value.timers.assembleFireMs
    }
  };
}

function isRunStats(value: unknown): value is RunStats {
  if (!isRecord(value)) return false;
  const keys: Array<keyof RunStats> = ['maxHp', 'hp', 'moveSpeed', 'damage', 'cooldown', 'area', 'duration', 'pickup', 'armor', 'evasion'];
  return keys.every((key) => isFiniteNumber(value[key]))
    && isPositiveNumber(value.maxHp)
    && isNonNegativeNumber(value.hp)
    && value.hp <= value.maxHp
    && isPositiveNumber(value.moveSpeed)
    && isPositiveNumber(value.damage)
    && isPositiveNumber(value.cooldown)
    && isPositiveNumber(value.area)
    && isPositiveNumber(value.duration)
    && isPositiveNumber(value.pickup)
    && isNonNegativeNumber(value.armor)
    && value.armor <= 1
    && isNonNegativeNumber(value.evasion)
    && value.evasion <= 1;
}

function isSpawnState(value: unknown): value is SpawnCheckpointState {
  return isRecord(value)
    && isNonNegativeNumber(value.spawnAccumulator)
    && isNonNegativeNumber(value.lastWaveId)
    && isNonNegativeNumber(value.budgetCredit)
    && Array.isArray(value.spawnedBosses)
    && value.spawnedBosses.every((id) => typeof id === 'string' && BOSS_IDS.has(id));
}

function isMissionState(value: unknown): value is MissionCheckpointState {
  return isRecord(value)
    && isNonNegativeNumber(value.cooldownMs)
    && (value.active === undefined || isActiveMission(value.active));
}

function isActiveMission(value: unknown): value is ActiveMission {
  return isRecord(value)
    && MISSION_TYPES.has(value.type as MissionType)
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && isNonNegativeNumber(value.progress)
    && isPositiveNumber(value.goal)
    && isNonNegativeNumber(value.timeLeftMs)
    && typeof value.complete === 'boolean'
    && typeof value.failed === 'boolean';
}

function isComboState(value: unknown): value is ComboCheckpointState {
  return isRecord(value)
    && isNonNegativeNumber(value.count)
    && isNonNegativeNumber(value.remainingMs)
    && typeof value.awardedAssemble === 'boolean';
}

function isPoint(value: unknown): value is { x: number; y: number } {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}
