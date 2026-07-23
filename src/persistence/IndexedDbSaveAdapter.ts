import { del, get, set } from 'idb-keyval';
import { migrateRunSnapshot, type RunSnapshot } from '../domain/run/RunSerializer';
import type { SaveAdapter } from './SaveAdapter';

const RUN_KEY = 'ogu-modular-active-run';

export class IndexedDbSaveAdapter implements SaveAdapter {
  async loadRun(): Promise<RunSnapshot | undefined> {
    return migrateRunSnapshot(await get<unknown>(RUN_KEY));
  }

  async saveRun(snapshot: RunSnapshot): Promise<void> {
    await set(RUN_KEY, snapshot);
  }

  async clearRun(): Promise<void> {
    await del(RUN_KEY);
  }
}

export const saveAdapter = new IndexedDbSaveAdapter();
