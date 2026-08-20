export type RunModeId = 'quick' | 'focus';

export interface RunModeDefinition {
  id: RunModeId;
  label: string;
  shortLabel: string;
  description: string;
  durationMs: number;
  timelineScale: number;
  spawnDensity: number;
  xpGainScale: number;
  upgradeSteps: number;
}

export const ORIGINAL_TIMELINE_MS = 900_000;
export const DEFAULT_RUN_MODE_ID: RunModeId = 'quick';

export const RUN_MODES: readonly RunModeDefinition[] = [
  {
    id: 'quick',
    label: '5분 스피드',
    shortLabel: '5분',
    description: '빠르고 빽빽한 한 판',
    durationMs: 300_000,
    timelineScale: 3,
    spawnDensity: 3,
    xpGainScale: 1 / 3,
    upgradeSteps: 2
  },
  {
    id: 'focus',
    label: '10분 집중',
    shortLabel: '10분',
    description: '길게 버티는 도전',
    durationMs: 600_000,
    timelineScale: 1.5,
    spawnDensity: 1.5,
    xpGainScale: 2 / 3,
    upgradeSteps: 2
  }
] as const;

export function isRunModeId(value: unknown): value is RunModeId {
  return RUN_MODES.some((mode) => mode.id === value);
}

export function getRunMode(id: RunModeId): RunModeDefinition {
  return RUN_MODES.find((mode) => mode.id === id) ?? RUN_MODES[0]!;
}
