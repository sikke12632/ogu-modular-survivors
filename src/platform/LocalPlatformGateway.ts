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
const PROFILE_FALLBACK_KEY = `${PROFILE_KEY}-fallback`;
const EMPTY_PROFILE: LocalProfile = { bestScore: 0, bestTimeMs: 0, totalRuns: 0, victories: 0 };

export class LocalPlatformGateway implements ScoreGateway {
  async loadProfile(): Promise<LocalProfile> {
    try {
      const profile = await get<unknown>(PROFILE_KEY);
      if (isLocalProfile(profile)) return profile;
    } catch {
      // Fall through to the localStorage recovery copy.
    }
    try {
      const raw = globalThis.localStorage?.getItem(PROFILE_FALLBACK_KEY);
      const profile = raw ? JSON.parse(raw) as unknown : undefined;
      return isLocalProfile(profile) ? profile : { ...EMPTY_PROFILE };
    } catch {
      return { ...EMPTY_PROFILE };
    }
  }

  async submit(result: RunResult): Promise<void> {
    const profile = await this.loadProfile();
    const next: LocalProfile = {
      bestScore: Math.max(profile.bestScore, result.score),
      bestTimeMs: Math.max(profile.bestTimeMs, result.elapsedMs),
      totalRuns: profile.totalRuns + 1,
      victories: profile.victories + (result.victory ? 1 : 0),
      lastResult: result
    };
    try {
      await set(PROFILE_KEY, next);
      globalThis.localStorage?.removeItem(PROFILE_FALLBACK_KEY);
    } catch (indexedDbError) {
      try {
        globalThis.localStorage?.setItem(PROFILE_FALLBACK_KEY, JSON.stringify(next));
        if (globalThis.localStorage?.getItem(PROFILE_FALLBACK_KEY) === null) throw indexedDbError;
      } catch {
        throw indexedDbError;
      }
    }
  }
}

export const platformGateway = new LocalPlatformGateway();

function isLocalProfile(value: unknown): value is LocalProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Partial<LocalProfile>;
  return Number.isFinite(profile.bestScore)
    && Number.isFinite(profile.bestTimeMs)
    && Number.isFinite(profile.totalRuns)
    && Number.isFinite(profile.victories)
    && profile.bestScore! >= 0
    && profile.bestTimeMs! >= 0
    && profile.totalRuns! >= 0
    && profile.victories! >= 0;
}
