import { createRunSnapshot, type RunCheckpoint } from '../domain/run/RunSerializer';
import type { RunState } from '../domain/run/RunState';
import { saveAdapter } from '../persistence/IndexedDbSaveAdapter';
import type { SaveAdapter } from '../persistence/SaveAdapter';
import { platformGateway, type RunResult, type ScoreGateway } from '../platform/LocalPlatformGateway';

export interface RunCompletionStatus {
  checkpointCleared: boolean;
  resultSubmitted: boolean;
}

export class RunLifecycleService {
  constructor(
    private readonly saves: SaveAdapter,
    private readonly scores: ScoreGateway
  ) {}

  saveCheckpoint(runId: string, state: RunState, checkpoint: RunCheckpoint): Promise<void> {
    return this.saves.saveRun(createRunSnapshot(runId, state, checkpoint));
  }

  clearCheckpoint(): Promise<void> {
    return this.saves.clearRun();
  }

  async completeRun(result: RunResult): Promise<RunCompletionStatus> {
    let checkpointCleared = true;
    let resultSubmitted = true;
    try {
      await this.saves.clearRun();
    } catch {
      checkpointCleared = false;
    }
    try {
      await this.scores.submit(result);
    } catch {
      resultSubmitted = false;
    }
    return { checkpointCleared, resultSubmitted };
  }
}

export const runLifecycleService = new RunLifecycleService(saveAdapter, platformGateway);
