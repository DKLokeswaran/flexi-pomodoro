import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Knex } from "knex";
import { openDatabase, type AppStores } from "../../db/index.js";
import { SessionService } from "../../services/session.service.js";
import { SettingsService } from "../../services/settings.service.js";
import { createMockSettingsStore } from "./mockSettingsStore.js";

/** Open a migrated temp DB with SessionService + (mocked) SettingsService. */
export async function openTempSessionServices(): Promise<{
  settings: SettingsService;
  session: SessionService;
  stores: AppStores;
  db: Knex;
  dataDir: string;
  dispose: () => Promise<void>;
}> {
  const dataDir = await mkdtemp(path.join(tmpdir(), "fpmd-session-"));
  const { db, stores } = await openDatabase(dataDir);
  const settings = new SettingsService(createMockSettingsStore());
  await settings.hydrate();
  const session = new SessionService({
    session: stores.session,
    phases: stores.phases,
  });
  return {
    settings,
    session,
    stores,
    db,
    dataDir,
    dispose: async () => {
      await db.destroy();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}
