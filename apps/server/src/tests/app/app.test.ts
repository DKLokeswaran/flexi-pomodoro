import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, afterEach, beforeEach, describe, it, mock } from "node:test";
import { SESSION_API } from "@flexi-pomodoro/shared";
import { buildApp } from "../../app.js";
import { openDatabase } from "../../db/index.js";

const T0 = Date.parse("2026-07-12T10:00:00.000Z");
const WORK_MS = 25 * 60_000;

describe("buildApp boot wiring", () => {
  const previousDataDir = process.env.DATA_DIR;
  let dataDir = "";
  let app: Awaited<ReturnType<typeof buildApp>>["app"] | null = null;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), "fpmd-app-"));
    process.env.DATA_DIR = dataDir;
    mock.timers.enable({ apis: ["Date", "setInterval"], now: T0 });
  });

  afterEach(async () => {
    await app?.close();
    app = null;
    mock.timers.reset();
    await rm(dataDir, { recursive: true, force: true });
  });

  after(() => {
    if (previousDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previousDataDir;
  });

  /** Boot the app against the test data dir (simulates a process start). */
  async function boot() {
    app = (await buildApp()).app;
    return app;
  }

  /** Stop the running app (simulates the process going down). */
  async function shutDown() {
    await app?.close();
    app = null;
  }

  /** Let pending scheduler work (async tick body) settle. */
  async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  it("restores the running session after a restart", async () => {
    const started = (
      await (await boot()).inject({ method: "POST", url: SESSION_API.start })
    ).json();
    assert.equal(started.status, "active");
    await shutDown();

    mock.timers.setTime(T0 + 60_000);
    const restored = (
      await (await boot()).inject({ method: "GET", url: SESSION_API.session })
    ).json();
    assert.equal(restored.status, "active");
    assert.equal(restored.session.id, started.session.id);
    assert.equal(restored.session.phase.kind, "planned_work");
    assert.equal(restored.session.liveStats.workedSec, 60);
  });

  it("catches up phases that ended while the server was down", async () => {
    await (await boot()).inject({ method: "POST", url: SESSION_API.start });
    await shutDown();

    // Down through planned end; back up 5s into the decision window.
    mock.timers.setTime(T0 + WORK_MS + 5_000);
    const restored = (
      await (await boot()).inject({ method: "GET", url: SESSION_API.session })
    ).json();
    assert.equal(restored.session.phase.kind, "decision");
    await shutDown();

    const { db } = await openDatabase(dataDir);
    const planned = await db("planned_work").first();
    await db.destroy();
    assert.equal(planned.endedReason, "recovery");
  });

  it("the scheduler advances the session on its own", async () => {
    const running = await boot();
    await running.inject({ method: "POST", url: SESSION_API.start });

    mock.timers.setTime(T0 + WORK_MS);
    mock.timers.tick(250);
    await settle();

    const snapshot = (
      await running.inject({ method: "GET", url: SESSION_API.session })
    ).json();
    assert.equal(snapshot.session.phase.kind, "decision");
  });

  it("finalizes yesterday at boot and the day that ends while running", async () => {
    const beforeMidnight = Date.parse("2026-07-12T23:59:59.900Z");
    mock.timers.setTime(beforeMidnight);
    await boot();

    const { db } = await openDatabase(dataDir);
    try {
      const atBoot = await db("daily_stats").select("clientDate");
      assert.deepEqual(
        atBoot.map((row) => row.clientDate),
        ["2026-07-11"],
      );

      mock.timers.setTime(beforeMidnight + 250);
      mock.timers.tick(250);
      await settle();

      const afterMidnight = await db("daily_stats")
        .select("clientDate")
        .orderBy("clientDate");
      assert.deepEqual(
        afterMidnight.map((row) => row.clientDate),
        ["2026-07-11", "2026-07-12"],
      );
    } finally {
      await db.destroy();
    }
  });
});
