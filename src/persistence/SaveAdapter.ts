import type { RunSnapshot } from '../domain/run/RunSerializer';

export interface SaveAdapter {
  loadRun(): Promise<RunSnapshot | undefined>;
  saveRun(snapshot: RunSnapshot): Promise<void>;
  clearRun(): Promise<void>;
}
