import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import knex, { type Knex } from "knex";

const DB_FILENAME = "flexi-pomodoro.sqlite3";

/**
 * Resolve the SQLite data directory.
 * `DATA_DIR` wins; otherwise `/data` in production and `./data` in dev.
 */
export function resolveDataDir(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string {
  if (env.DATA_DIR) return path.resolve(env.DATA_DIR);
  if (env.NODE_ENV === "production") return "/data";
  return path.resolve(cwd, "data");
}

/** Absolute path to the SQLite file under `dataDir`. */
export function sqlitePath(dataDir: string): string {
  return path.join(dataDir, DB_FILENAME);
}

function migrationsConfig(): Knex.MigratorConfig {
  const directory = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "migrations",
  );
  // Under tsx this module is .ts; compiled dist loads .js migrations.
  const extension = import.meta.url.endsWith(".ts") ? "ts" : "js";
  return {
    directory,
    loadExtensions: [`.${extension}`],
  };
}

/** Open a Knex SQLite client for the given data directory (creates the dir). */
export function createKnex(dataDir: string): Knex {
  mkdirSync(dataDir, { recursive: true });
  return knex({
    client: "better-sqlite3",
    connection: { filename: sqlitePath(dataDir) },
    useNullAsDefault: true,
    migrations: migrationsConfig(),
  });
}

/** Run pending migrations against an open Knex instance. */
export async function migrateLatest(db: Knex): Promise<void> {
  await db.migrate.latest();
}
