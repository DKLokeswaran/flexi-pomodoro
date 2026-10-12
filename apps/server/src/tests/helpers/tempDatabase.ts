import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Knex } from "knex";
import { openDatabase, type AppStores } from "../../db/index.js";

/** Open a migrated temp SQLite DB for store tests. */
export async function openTempDatabase(): Promise<{
  db: Knex;
  stores: AppStores;
  dispose: () => Promise<void>;
}> {
  const dataDir = await mkdtemp(path.join(tmpdir(), "fpmd-store-"));
  const { db, stores } = await openDatabase(dataDir);
  return {
    db,
    stores,
    dispose: async () => {
      await db.destroy();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}
