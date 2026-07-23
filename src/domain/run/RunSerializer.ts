import { GAME_VERSION, SAVE_SCHEMA_VERSION } from '../../app/version';
import type { RunState } from './RunState';

export interface RunSnapshot {
  schemaVersion: number;
  gameVersion: string;
  savedAt: number;
  runId: string;
  state: RunState;
}

export function createRunSnapshot(runId: string, state: RunState): RunSnapshot {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    gameVersion: GAME_VERSION,
    savedAt: Date.now(),
    runId,
    state: structuredClone(state)
  };
}

export function migrateRunSnapshot(value: unknown): RunSnapshot | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const snapshot = value as Partial<RunSnapshot>;
  if (snapshot.schemaVersion !== SAVE_SCHEMA_VERSION || !snapshot.state || !snapshot.runId) return undefined;
  return snapshot as RunSnapshot;
}
