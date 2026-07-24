import type { FastifyInstance } from "fastify";
import type { SettingsService } from "../services/settings.service.js";
import type { SessionService } from "../services/session.service.js";
import { registerHealthRoutes } from "./health.routes.js";
import { registerSessionRoutes } from "./session.routes.js";
import { registerSettingsRoutes } from "./settings.routes.js";

export interface RouteDeps {
  settings: SettingsService;
  session: SessionService;
}

export async function registerRoutes(
  app: FastifyInstance,
  deps: RouteDeps,
): Promise<void> {
  registerHealthRoutes(app);
  registerSettingsRoutes(app, deps.settings);
  registerSessionRoutes(app, deps);
}
