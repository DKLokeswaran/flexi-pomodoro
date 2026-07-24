import type { FastifyInstance } from "fastify";
import { type SettingsPatch, SESSION_API, SettingsPatchSchema } from "@flexi-pomodoro/shared";
import { ZodError } from "zod";
import {
  SettingsError,
  SettingsService,
  toSettingsError,
} from "../services/settings.service.js";

function errorReply(err: unknown): { statusCode: number; body: object } {
  const normalized = err instanceof ZodError ? toSettingsError(err) : err;
  if (normalized instanceof SettingsError) {
    return {
      statusCode: 400,
      body: { error: normalized.message, code: normalized.code },
    };
  }
  throw err;
}

export function registerSettingsRoutes(
  app: FastifyInstance,
  settings: SettingsService,
): void {
  app.get(SESSION_API.settings, async () => settings.get());

  app.put<{ Body: SettingsPatch }>(SESSION_API.settings, async (req, reply) => {
    try {
      const patch = SettingsPatchSchema.parse(req.body ?? {});
      return settings.update(patch);
    } catch (err) {
      const { statusCode, body } = errorReply(err);
      return reply.code(statusCode).send(body);
    }
  });
}
