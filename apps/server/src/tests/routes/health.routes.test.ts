import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SESSION_API } from "@flexi-pomodoro/shared";
import { openRoutesApp } from "../helpers/routesApp.js";

describe("health routes", () => {
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
});
