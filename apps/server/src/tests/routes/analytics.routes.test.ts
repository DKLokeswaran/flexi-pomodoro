import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Fastify from "fastify";
import {
  ANALYTICS_API,
  type TodayStatsResponse,
} from "@flexi-pomodoro/shared";
import { registerAnalyticsRoutes } from "../../routes/analytics.routes.js";
import type { AnalyticsService } from "../../services/analytics.service.js";

const FIXED_TODAY: TodayStatsResponse = {
  clientDate: "2026-11-09",
  dayStart: "2026-11-08T18:30:00.000Z",
  dayEnd: "2026-11-09T18:30:00.000Z",
  workedSec: 42,
  deliberationSec: 0,
  restSec: 0,
  pausedSec: 0,
};

describe("registerAnalyticsRoutes", () => {
  it("GET today returns settings-owned totals and ignores day query params", async () => {
    let calls = 0;
    const analytics = {
      todayStats: async () => {
        calls += 1;
        return FIXED_TODAY;
      },
    } as Pick<AnalyticsService, "todayStats">;

    const app = Fastify();
    registerAnalyticsRoutes(app, analytics as AnalyticsService);

    const plain = await app.inject({
      method: "GET",
      url: ANALYTICS_API.today,
    });
    const withQuery = await app.inject({
      method: "GET",
      url: `${ANALYTICS_API.today}?dayStart=2020-01-01T00:00:00.000Z&dayEnd=2020-01-02T00:00:00.000Z&clientDate=1999-01-01`,
    });

    assert.equal(plain.statusCode, 200);
    assert.equal(withQuery.statusCode, 200);
    assert.deepEqual(plain.json(), FIXED_TODAY);
    assert.deepEqual(withQuery.json(), FIXED_TODAY);
    assert.equal(calls, 2);

    await app.close();
  });
});
