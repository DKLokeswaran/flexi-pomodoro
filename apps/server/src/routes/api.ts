import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  type SessionSnapshot,
  type SettingsPatch,
  type StartSessionBody,
  SESSION_API,
  SettingsPatchSchema,
  parseStartSessionBody,
} from "@flexi-pomodoro/shared";
import { ZodError } from "zod";
import { SessionEngine, SessionError, toSessionError } from "../session/engine.js";

function errorReply(err: unknown): { statusCode: number; body: object } {
  const normalized = err instanceof ZodError ? toSessionError(err) : err;
  if (normalized instanceof SessionError) {
    const status =
      normalized.code === "NO_SESSION" || normalized.code === "SESSION_ACTIVE"
        ? 409
        : normalized.code === "INVALID_SETTINGS"
          ? 400
          : normalized.code === "FORBIDDEN" || normalized.code === "PARAMS_LOCKED"
            ? 403
            : 400;
    return {
      statusCode: status,
      body: { error: normalized.message, code: normalized.code },
    };
  }
  throw err;
}

function parseSinceSeq(raw: unknown): number {
  const n = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : 0;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Missing/zero watermark → current high-water (no history replay). */
function resolveSinceSeq(raw: unknown, engine: SessionEngine): number {
  const parsed = parseSinceSeq(raw);
  return parsed > 0 ? parsed : engine.getAlertSeq();
}

export async function registerApiRoutes(
  app: FastifyInstance,
  engine: SessionEngine,
): Promise<void> {
  app.get(SESSION_API.health, async () => ({ ok: true }));

  app.get(SESSION_API.settings, async () => engine.getSettings());

  app.put<{ Body: SettingsPatch }>(SESSION_API.settings, async (req, reply) => {
    try {
      const patch = SettingsPatchSchema.parse(req.body ?? {});
      return engine.updateSettings(patch);
    } catch (err) {
      const { statusCode, body } = errorReply(err);
      return reply.code(statusCode).send(body);
    }
  });

  app.get(SESSION_API.alertSeq, async () => ({
    alertSeq: engine.getAlertSeq(),
  }));

  app.get<{ Querystring: { sinceSeq?: string } }>(
    SESSION_API.session,
    async (req) => {
      const sinceSeq = resolveSinceSeq(req.query.sinceSeq, engine);
      return engine.getSnapshot(Date.now(), sinceSeq);
    },
  );

  app.get<{ Querystring: { sinceSeq?: string } }>(
    SESSION_API.events,
    async (req, reply) => {
      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const send = (data: SessionSnapshot) => {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const sinceSeq = resolveSinceSeq(req.query.sinceSeq, engine);
      send(engine.getSnapshot(Date.now(), sinceSeq));

      const unsubscribe = engine.subscribe((snapshot) => {
        send(snapshot);
      }, engine.getAlertSeq());

      const heartbeat = setInterval(() => {
        reply.raw.write(": heartbeat\n\n");
      }, 25_000);

      req.raw.on("close", () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    },
  );

  app.post<{ Body: StartSessionBody }>(SESSION_API.start, async (req, reply) => {
    try {
      const { debug, overrides } = parseStartSessionBody(req.body ?? {});
      return engine.start(overrides, Date.now(), { debug });
    } catch (err) {
      const { statusCode, body } = errorReply(err);
      return reply.code(statusCode).send(body);
    }
  });

  const action =
    (fn: () => SessionSnapshot) =>
    async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        return fn();
      } catch (err) {
        const { statusCode, body } = errorReply(err);
        return reply.code(statusCode).send(body);
      }
    };

  app.post(SESSION_API.ackRest, action(() => engine.ackRest()));
  app.post(SESSION_API.continue, action(() => engine.continueExtended()));
  app.post(SESSION_API.startRest, action(() => engine.startRest()));
  app.post(SESSION_API.softPause, action(() => engine.softPause()));
  app.post(SESSION_API.softResume, action(() => engine.softResume()));
  app.post(SESSION_API.endLongRest, action(() => engine.endLongRest()));
}
