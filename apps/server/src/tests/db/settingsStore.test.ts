import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { DEFAULT_SETTINGS } from "@flexi-pomodoro/shared";
import { openDatabase } from "../../db/index.js";

describe("SettingsStore (SQLite)", () => {
  const tempDirs: string[] = [];

  after(async () => {
    for (const dir of tempDirs) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  async function tempDataDir(): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), "fpmd-store-"));
    tempDirs.push(dir);
    return dir;
  }

  it("ensureSeeded writes DEFAULT_SETTINGS once", async () => {
    const { db, stores } = await openDatabase(await tempDataDir());
    try {
      const first = await stores.settings.ensureSeeded();
      const second = await stores.settings.ensureSeeded();
      assert.deepEqual(first, DEFAULT_SETTINGS);
      assert.deepEqual(second, DEFAULT_SETTINGS);
      assert.deepEqual(await stores.settings.load(), DEFAULT_SETTINGS);
    } finally {
      await db.destroy();
    }
  });

  it("save and load round-trip", async () => {
    const dataDir = await tempDataDir();
    const first = await openDatabase(dataDir);
    try {
      await first.stores.settings.ensureSeeded();
      await first.stores.settings.save({
        ...DEFAULT_SETTINGS,
        workDurationSec: 30 * 60,
        workPauseStrategy: "hard",
        alertsMuted: true,
      });
    } finally {
      await first.db.destroy();
    }

    const second = await openDatabase(dataDir);
    try {
      const loaded = await second.stores.settings.load();
      assert.equal(loaded?.workDurationSec, 30 * 60);
      assert.equal(loaded?.workPauseStrategy, "hard");
      assert.equal(loaded?.alertsMuted, true);
    } finally {
      await second.db.destroy();
    }
  });

  it("initial migration creates expected tables", async () => {
    const { db, stores } = await openDatabase(await tempDataDir());
    try {
      assert.ok(stores.settings);
      assert.ok(stores.session);
      assert.ok(stores.phases);
      const tables = await db.raw(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      );
      const names = (tables as { name: string }[]).map((row) => row.name);
      for (const name of [
        "settings",
        "sessions",
        "phases",
        "session_runtime",
        "planned_work",
        "decision",
        "short_rest_ack",
        "extended_work",
        "rest",
        "pause_slices",
      ]) {
        assert.ok(names.includes(name), `missing table ${name}`);
      }
    } finally {
      await db.destroy();
    }
  });
});
