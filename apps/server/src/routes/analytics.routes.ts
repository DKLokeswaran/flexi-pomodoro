import type { FastifyInstance } from "fastify";
import { ANALYTICS_API } from "@flexi-pomodoro/shared";
import type { AnalyticsService } from "../services/analytics.service.js";

/**
 * Analytics HTTP routes. Day bounds come from `settings.timezone` only —
 * query params such as `dayStart` / `dayEnd` are ignored.
 */
export function registerAnalyticsRoutes(
  app: FastifyInstance,
  analytics: AnalyticsService,
): void {
  app.get(ANALYTICS_API.today, async () => analytics.todayStats());
}
