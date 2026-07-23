import { del, get, set } from 'idb-keyval';
import { migrateRunSnapshot, type RunSnapshot } from '../domain/run/RunSerializer';
import type { SaveAdapter } from './SaveAdapter';

const RUN_KEY = 'ogu-modular-active-run';
const FALLBACK_KEY = `${RUN_KEY}-fallback`;

export interface AsyncKeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

export type FallbackStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const indexedDbStore: AsyncKeyValueStore = {
  get,
  set,
  delete: del
};

export class IndexedDbSaveAdapter implements SaveAdapter {
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: AsyncKeyValueStore = indexedDbStore,
    private readonly suppliedFallback?: FallbackStorage
  ) {}

  async loadRun(): Promise<RunSnapshot | undefined> {
    await this.queue.catch(() => undefined);
    try {
      const snapshot = migrateRunSnapshot(await this.store.get(RUN_KEY));
      if (snapshot) return snapshot;
    } catch {
      // A validated localStorage checkpoint is used below when IndexedDB is unavailable.
    }
    return this.loadFallback();
  }

  saveRun(snapshot: RunSnapshot): Promise<void> {
    const immutableSnapshot = structuredClone(snapshot);
    const operation = this.queue
      .catch(() => undefined)
      .then(() => this.persist(immutableSnapshot));
    this.queue = operation;
    return operation;
  }

  clearRun(): Promise<void> {
    const operation = this.queue
      .catch(() => undefined)
      .then(async () => {
        let indexedDbError: unknown;
        try {
          await this.store.delete(RUN_KEY);
        } catch (error) {
          indexedDbError = error;
        }
        const fallbackCleared = this.clearFallback();
        if (!fallbackCleared) {
          throw new AggregateError(
            [indexedDbError, new Error('localStorage clear failed')].filter(Boolean),
            'Could not clear the active run checkpoint'
          );
        }
      });
    this.queue = operation;
    return operation;
  }

  private async persist(snapshot: RunSnapshot): Promise<void> {
    try {
      await this.store.set(RUN_KEY, snapshot);
      if (!this.clearFallback()) this.saveFallback(snapshot);
    } catch (indexedDbError) {
      if (!this.saveFallback(snapshot)) {
        throw new AggregateError([indexedDbError], 'IndexedDB and localStorage checkpoint writes failed');
      }
    }
  }

  private loadFallback(): RunSnapshot | undefined {
    try {
      const storage = this.getFallbackStorage();
      if (!storage) return undefined;
      const raw = storage.getItem(FALLBACK_KEY);
      return raw ? migrateRunSnapshot(JSON.parse(raw) as unknown) : undefined;
    } catch {
      return undefined;
    }
  }

  private saveFallback(snapshot: RunSnapshot): boolean {
    try {
      const storage = this.getFallbackStorage();
      if (!storage) return false;
      storage.setItem(FALLBACK_KEY, JSON.stringify(snapshot));
      return storage.getItem(FALLBACK_KEY) !== null;
    } catch {
      return false;
    }
  }

  private clearFallback(): boolean {
    try {
      const storage = this.getFallbackStorage();
      if (!storage) return true;
      storage.removeItem(FALLBACK_KEY);
      return true;
    } catch {
      return false;
    }
  }

  private getFallbackStorage(): FallbackStorage | undefined {
    if (this.suppliedFallback) return this.suppliedFallback;
    try {
      return globalThis.localStorage;
    } catch {
      return undefined;
    }
  }
}

export const saveAdapter = new IndexedDbSaveAdapter();
