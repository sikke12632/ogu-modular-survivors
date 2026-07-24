import { describe, expect, it } from 'vitest';
import { createRunSnapshot, type RunSnapshot } from '../../src/domain/run/RunSerializer';
import {
  IndexedDbSaveAdapter,
  type AsyncKeyValueStore,
  type FallbackStorage
} from '../../src/persistence/IndexedDbSaveAdapter';
import { createMemoryStorage, makeRunState } from './fixtures/run';

describe('checkpoint deletion safety', () => {
  it('uses a tombstone to prevent a failed IndexedDB deletion from reviving a stale run', async () => {
    let stored: RunSnapshot | undefined = createRunSnapshot('stale', makeRunState());
    const store: AsyncKeyValueStore = {
      get: async () => stored,
      set: async (_key, value) => { stored = value as RunSnapshot; },
      delete: async () => { throw new Error('IndexedDB temporarily unavailable'); }
    };
    const adapter = new IndexedDbSaveAdapter(store, createMemoryStorage());

    await adapter.clearRun();
    expect(await adapter.loadRun()).toBeUndefined();

    await adapter.saveRun(createRunSnapshot('new-run', makeRunState()));
    expect((await adapter.loadRun())?.runId).toBe('new-run');
  });

  it('rejects deletion when neither the primary store nor a tombstone can be updated', async () => {
    const failedStore: AsyncKeyValueStore = {
      get: async () => undefined,
      set: async () => undefined,
      delete: async () => { throw new Error('blocked'); }
    };
    const failedFallback: FallbackStorage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); }
    };
    const adapter = new IndexedDbSaveAdapter(failedStore, failedFallback);
    await expect(adapter.clearRun()).rejects.toThrow('Could not safely clear');
  });
});
