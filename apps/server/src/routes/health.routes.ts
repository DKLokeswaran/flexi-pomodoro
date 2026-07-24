import type { FastifyInstance } from "fastify";
import { SESSION_API } from "@flexi-pomodoro/shared";

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get(SESSION_API.health, async () => ({ ok: true }));
}
