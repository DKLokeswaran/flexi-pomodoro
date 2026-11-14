import Fastify, { type FastifyInstance } from "fastify";
import type { AnalyticsService } from "../../services/analytics.service.js";
import { SessionService } from "../../services/session.service.js";
import { SettingsService } from "../../services/settings.service.js";
import { registerRoutes } from "../../routes/index.js";
import { createMockSessionStores } from "./mockSessionStores.js";
import { createMockSettingsStore } from "./mockSettingsStore.js";

/** Short session timings used by route tests (seconds). */
export const ROUTE_TEST_TIMINGS = {
  workDurationSec: 60,
  shortRestDurationSec: 60,
  longRestDurationSec: 120,
  cyclesBeforeLongRest: 2,
  decisionWindowSec: 15,
} as const;

/** Fastify app with every route registered over in-memory stores. */
export async function openRoutesApp(): Promise<{
  app: FastifyInstance;
  settings: SettingsService;
  session: SessionService;
}> {
  const settings = new SettingsService(createMockSettingsStore());
  await settings.hydrate();
  await settings.update(ROUTE_TEST_TIMINGS);
  const session = new SessionService(createMockSessionStores());
  const analytics = {} as AnalyticsService;
  const app = Fastify();
  await registerRoutes(app, { settings, session, analytics });
  return { app, settings, session };
}
