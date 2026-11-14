import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, it, mock } from "node:test";
import type { FastifyInstance } from "fastify";
import { SESSION_API, type SessionSnapshot } from "@flexi-pomodoro/shared";
import { openRoutesApp, ROUTE_TEST_TIMINGS } from "../helpers/routesApp.js";

const T0 = Date.parse("2026-07-12T10:00:00.000Z");

/** POST a session action and return status + parsed body. */
async function post(app: FastifyInstance, url: string, payload?: object) {
  const response = await app.inject({ method: "POST", url, payload });
  return { statusCode: response.statusCode, body: response.json() };
}

/** Phase kind of a snapshot body ("idle" when no session). */
function phaseKind(snapshot: SessionSnapshot): string {
  return snapshot.status === "active" ? snapshot.session.phase.kind : "idle";
}

describe("session routes", () => {
  let app: FastifyInstance | null = null;

  afterEach(async () => {
    mock.timers.reset();
    await app?.close();
    app = null;
  });

  /** Routes app with the wall clock frozen at T0. */
  async function openAt(nowMs: number = T0) {
    mock.timers.enable({ apis: ["Date"], now: nowMs });
    const ctx = await openRoutesApp();
    app = ctx.app;
    return ctx;
  }

  it("POST start uses saved settings and the saved pause strategy", async () => {
    const { app, settings } = await openAt();
    await settings.update({ workPauseStrategy: "hard" });

    const { statusCode, body } = await post(app, SESSION_API.start);
    assert.equal(statusCode, 200);
    assert.equal(body.status, "active");
    assert.deepEqual(body.session.params, ROUTE_TEST_TIMINGS);
    assert.equal(body.session.pauseStrategy, "hard");
    assert.equal(body.session.phase.kind, "planned_work");
    assert.equal(body.session.startedAt, new Date(T0).toISOString());
  });

  it("POST start applies body overrides and rejects out-of-range ones", async () => {
    const { app } = await openAt();
    const rejected = await post(app, SESSION_API.start, { workDurationSec: 1 });
    assert.equal(rejected.statusCode, 400);
    assert.equal(rejected.body.code, "INVALID_SETTINGS");

    const started = await post(app, SESSION_API.start, {
      workDurationSec: 300,
    });
    assert.equal(started.statusCode, 200);
    assert.equal(started.body.session.params.workDurationSec, 300);
    assert.equal(started.body.session.params.shortRestDurationSec, 60);
  });

  it("each action route runs its own action through a whole session", async () => {
    const { app } = await openAt();
    let now = T0;
    const advance = (ms: number) => {
      now += ms;
      mock.timers.setTime(now);
    };
    const act = async (url: string, expectedPhase: string) => {
      const { statusCode, body } = await post(app, url);
      assert.equal(statusCode, 200, `${url} → ${JSON.stringify(body)}`);
      assert.equal(phaseKind(body), expectedPhase, url);
      return body;
    };

    await act(SESSION_API.start, "planned_work");
    advance(10_000);
    const paused = await act(SESSION_API.pause, "planned_work");
    assert.equal(paused.session.phase.paused, true);
    advance(5_000);
    const resumed = await act(SESSION_API.resume, "planned_work");
    assert.equal(resumed.session.phase.paused, false);
    assert.equal(resumed.session.phase.pausedSec, 5);

    advance(46_000); // 1s into the decision window
    await act(SESSION_API.continue, "extended_work");
    advance(4_000);
    await act(SESSION_API.startRest, "short_rest");
    advance(61_000); // 1s into the short-rest ack window
    const cycleTwo = await act(SESSION_API.ackWork, "planned_work");
    assert.equal(cycleTwo.session.phase.cycleIndex, 2);
    advance(61_000);
    await act(SESSION_API.ackRest, "long_rest");
    advance(10_000);
    await act(SESSION_API.endLongRest, "idle");
  });

  it("rejections map to HTTP status and error code", async () => {
    const { app } = await openAt();
    const expectError = async (url: string, status: number, code: string) => {
      const { statusCode, body } = await post(app, url);
      assert.equal(statusCode, status, url);
      assert.equal(body.code, code, url);
      assert.equal(typeof body.error, "string");
    };

    for (const url of [
      SESSION_API.pause,
      SESSION_API.resume,
      SESSION_API.ackRest,
      SESSION_API.ackWork,
      SESSION_API.continue,
      SESSION_API.startRest,
      SESSION_API.endLongRest,
    ]) {
      await expectError(url, 409, "NO_SESSION");
    }

    assert.equal((await post(app, SESSION_API.start)).statusCode, 200);
    await expectError(SESSION_API.start, 409, "SESSION_ACTIVE");
    await expectError(SESSION_API.resume, 400, "NOT_PAUSED");
    await expectError(SESSION_API.ackRest, 400, "INVALID_PHASE");
    assert.equal((await post(app, SESSION_API.pause)).statusCode, 200);
    await expectError(SESSION_API.pause, 400, "ALREADY_PAUSED");
  });

  it("GET session and alert-seq report state; sinceSeq selects the alert delta", async () => {
    const { app, session } = await openAt();
    const idle = await app.inject({ method: "GET", url: SESSION_API.session });
    assert.equal(idle.json().status, "idle");

    await post(app, SESSION_API.start);
    mock.timers.setTime(T0 + 61_000);
    await session.tickIfIdle(T0 + 61_000, false);
    await post(app, SESSION_API.ackRest); // seq 1 work end, 2 rest_ack, 3 rest start

    const seq = await app.inject({ method: "GET", url: SESSION_API.alertSeq });
    assert.deepEqual(seq.json(), { alertSeq: 3 });

    // No watermark → current high-water, so nothing is replayed.
    const plain = await app.inject({ method: "GET", url: SESSION_API.session });
    assert.equal(plain.json().session.phase.kind, "short_rest");
    assert.equal(plain.json().serverNow, new Date(T0 + 61_000).toISOString());
    assert.deepEqual(plain.json().session.pendingAlerts, []);

    const since = await app.inject({
      method: "GET",
      url: `${SESSION_API.session}?sinceSeq=1`,
    });
    assert.deepEqual(since.json().session.pendingAlerts, [
      { seq: 2, id: "rest_ack" },
      { seq: 3, id: "short_rest_start" },
    ]);
  });
});

/** Open the SSE stream over real HTTP and collect parsed snapshot frames. */
function openEventStream(port: number, query = "") {
  const frames: SessionSnapshot[] = [];
  const waiters: Array<() => void> = [];
  let headers: http.IncomingHttpHeaders = {};
  let buffer = "";
  const request = http.get(
    { host: "127.0.0.1", port, path: `${SESSION_API.events}${query}` },
    (response) => {
      headers = response.headers;
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        buffer += chunk;
        let end = buffer.indexOf("\n\n");
        while (end !== -1) {
          const frame = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (frame.startsWith("data: ")) {
            frames.push(JSON.parse(frame.slice("data: ".length)));
          }
          end = buffer.indexOf("\n\n");
        }
        waiters.splice(0).forEach((wake) => wake());
      });
    },
  );
  request.on("error", () => {});

  /** Resolve once at least `count` frames have arrived. */
  async function waitForFrames(count: number): Promise<SessionSnapshot[]> {
    const deadline = Date.now() + 5_000;
    while (frames.length < count) {
      if (Date.now() > deadline) {
        throw new Error(`timed out waiting for SSE frame ${count}`);
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 100);
        waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    return frames;
  }

  return {
    frames,
    waitForFrames,
    headers: () => headers,
    close: () => request.destroy(),
  };
}

describe("session SSE stream", () => {
  it("sends the current snapshot on connect, then one frame per update", async () => {
    const { app, session } = await openRoutesApp();
    await app.listen({ host: "127.0.0.1", port: 0 });
    const port = (app.server.address() as AddressInfo).port;
    const stream = openEventStream(port);
    try {
      let frames = await stream.waitForFrames(1);
      assert.equal(stream.headers()["content-type"], "text/event-stream");
      assert.equal(frames[0].status, "idle");

      await post(app, SESSION_API.start);
      frames = await stream.waitForFrames(2);
      assert.equal(phaseKind(frames[1]), "planned_work");

      await post(app, SESSION_API.pause);
      frames = await stream.waitForFrames(3);
      const paused = frames[2];
      assert.ok(paused.status === "active");
      assert.ok(
        paused.session.phase.kind === "planned_work" &&
          paused.session.phase.paused,
      );

      // A scheduler-style tick past planned end pushes the alert to the stream.
      await post(app, SESSION_API.resume);
      frames = await stream.waitForFrames(4);
      const resumed = frames[3];
      if (resumed.status !== "active") throw new Error("expected active");
      const work = resumed.session.phase;
      if (work.kind !== "planned_work") throw new Error("expected work");
      const plannedEndMs = Date.parse(work.plannedEndAt);
      assert.equal(await session.tickIfIdle(plannedEndMs, true), true);
      frames = await stream.waitForFrames(5);
      const decision = frames[4];
      assert.ok(decision.status === "active");
      assert.equal(decision.session.phase.kind, "decision");
      assert.deepEqual(
        decision.session.pendingAlerts.map((alertEvent) => alertEvent.id),
        ["work_planned_end"],
      );
    } finally {
      stream.close();
      await app.close();
    }
  });

  it("stops writing to a stream after the client disconnects", async () => {
    const { app } = await openRoutesApp();
    await app.listen({ host: "127.0.0.1", port: 0 });
    const port = (app.server.address() as AddressInfo).port;
    const first = openEventStream(port);
    const second = openEventStream(port);
    try {
      await first.waitForFrames(1);
      await second.waitForFrames(1);
      first.close();
      await new Promise((resolve) => setTimeout(resolve, 50));

      await post(app, SESSION_API.start);
      await second.waitForFrames(2);
      assert.equal(first.frames.length, 1);
      assert.equal(phaseKind(second.frames[1]), "planned_work");
    } finally {
      first.close();
      second.close();
      await app.close();
    }
  });
});
