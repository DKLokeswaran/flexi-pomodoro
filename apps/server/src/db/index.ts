import type { Knex } from "knex";
import { createKnex, migrateLatest, resolveDataDir } from "./knex.js";
import { PhasesStore } from "./stores/phasesStore.js";
import { SessionStore } from "./stores/sessionStore.js";
import { SettingsStore } from "./stores/settingsStore.js";

export {
  createKnex,
  migrateLatest,
  resolveDataDir,
  sqlitePath,
} from "./knex.js";
export { PhasesStore } from "./stores/phasesStore.js";
export { SessionStore } from "./stores/sessionStore.js";
export { SettingsStore } from "./stores/settingsStore.js";

/** Purpose-split stores sharing one Knex instance. */
export type AppStores = {
  settings: SettingsStore;
  session: SessionStore;
  phases: PhasesStore;
};

/** Construct purpose-split stores over a shared Knex client. */
export function createStores(db: Knex): AppStores {
  return {
    settings: new SettingsStore(db),
    session: new SessionStore(db),
    phases: new PhasesStore(db),
  };
}

/**
 * Open SQLite under DATA_DIR (or defaults), migrate, and build stores.
 * Caller must `db.destroy()` on shutdown.
 */
export async function openDatabase(dataDir: string = resolveDataDir()): Promise<{
  db: Knex;
  stores: AppStores;
  dataDir: string;
}> {
  const db = createKnex(dataDir);
  await migrateLatest(db);
  return { db, stores: createStores(db), dataDir };
}
