import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SESSION_API } from "@flexi-pomodoro/shared";
import { openRoutesApp, ROUTE_TEST_TIMINGS } from "../helpers/routesApp.js";

describe("settings and health routes", () => {
  it("GET health reports ok", async () => {
    const { app } = await openRoutesApp();
    const response = await app.inject({
      method: "GET",
      url: SESSION_API.health,
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { ok: true });
    await app.close();
  });

  it("PUT settings saves the patch and GET returns it", async () => {
    const { app } = await openRoutesApp();
    const put = await app.inject({
      method: "PUT",
      url: SESSION_API.settings,
      payload: { workDurationSec: 1800, timezone: "Asia/Kolkata" },
    });
    assert.equal(put.statusCode, 200);
    assert.equal(put.json().workDurationSec, 1800);

    const get = await app.inject({ method: "GET", url: SESSION_API.settings });
    assert.equal(get.statusCode, 200);
    assert.deepEqual(get.json(), {
      ...ROUTE_TEST_TIMINGS,
      workDurationSec: 1800,
      alertsMuted: false,
      workPauseStrategy: "soft",
      timezone: "Asia/Kolkata",
    });
    await app.close();
  });

  it("PUT settings rejects an invalid patch with 400 and keeps the old values", async () => {
    const { app } = await openRoutesApp();
    const put = await app.inject({
      method: "PUT",
      url: SESSION_API.settings,
      payload: { workDurationSec: 1 },
    });
    assert.equal(put.statusCode, 400);
    assert.equal(put.json().code, "INVALID_SETTINGS");

    const get = await app.inject({ method: "GET", url: SESSION_API.settings });
    assert.equal(
      get.json().workDurationSec,
      ROUTE_TEST_TIMINGS.workDurationSec,
    );
    await app.close();
  });
});
