import { get, set } from 'idb-keyval';
import type { CharacterId } from '../data/characters';

export interface RunResult {
  runId: string;
  characterId: CharacterId;
  victory: boolean;
  score: number;
  kills: number;
  level: number;
  elapsedMs: number;
  endedAt: number;
}

export interface LocalProfile {
  bestScore: number;
  bestTimeMs: number;
  totalRuns: number;
  victories: number;
  lastResult?: RunResult;
}

export interface ScoreGateway {
  submit(result: RunResult): Promise<void>;
}

const PROFILE_KEY = 'ogu-modular-profile';

export class LocalPlatformGateway implements ScoreGateway {
  async loadProfile(): Promise<LocalProfile> {
    return (await get<LocalProfile>(PROFILE_KEY)) ?? { bestScore: 0, bestTimeMs: 0, totalRuns: 0, victories: 0 };
  }

  async submit(result: RunResult): Promise<void> {
    const profile = await this.loadProfile();
    await set(PROFILE_KEY, {
      bestScore: Math.max(profile.bestScore, result.score),
      bestTimeMs: Math.max(profile.bestTimeMs, result.elapsedMs),
      totalRuns: profile.totalRuns + 1,
      victories: profile.victories + (result.victory ? 1 : 0),
      lastResult: result
    });
  }
}

export const platformGateway = new LocalPlatformGateway();
