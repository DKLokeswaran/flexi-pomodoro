import type { FastifyInstance } from "fastify";
import { type SettingsPatch, SESSION_API } from "@flexi-pomodoro/shared";
import type { SettingsService } from "../services/settings.service.js";
import { errorReply } from "../utils/errorReply.js";
import { SettingsPatchSchema } from "../utils/settingsValidation.js";

/** GET/PUT persisted session defaults (production bounds; not debug overrides). */
export function registerSettingsRoutes(
  app: FastifyInstance,
  settings: SettingsService,
): void {
  app.get(SESSION_API.settings, async () => settings.get());

  app.put<{ Body: SettingsPatch }>(SESSION_API.settings, async (req, reply) => {
    try {
      const patch = SettingsPatchSchema.parse(req.body ?? {});
      return settings.update(patch);
    } catch (error) {
      const { statusCode, body } = errorReply(error);
      return reply.code(statusCode).send(body);
    }
  });
}
