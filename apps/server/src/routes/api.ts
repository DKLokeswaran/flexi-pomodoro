import type { FastifyInstance } from "fastify";
import {
  type SessionOverrides,
  type SettingsPatch,
  SessionOverridesSchema,
  SettingsPatchSchema,
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
  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/settings", async () => engine.getSettings());

  app.put<{ Body: SettingsPatch }>("/api/settings", async (req, reply) => {
    try {
      const patch = SettingsPatchSchema.parse(req.body ?? {});
      return engine.updateSettings(patch);
    } catch (err) {
      const { statusCode, body } = errorReply(err);
      return reply.code(statusCode).send(body);
    }
  });

  app.get<{ Querystring: { sinceSeq?: string } }>(
    "/api/session",
    async (req) => {
      const sinceSeq = resolveSinceSeq(req.query.sinceSeq, engine);
      return engine.getSnapshot(Date.now(), sinceSeq);
    },
  );

  app.get<{ Querystring: { sinceSeq?: string } }>(
    "/api/session/events",
    async (req, reply) => {
      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const send = (data: unknown) => {
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

  app.post<{ Body: SessionOverrides }>("/api/session/start", async (req, reply) => {
    try {
      const overrides = SessionOverridesSchema.parse(req.body ?? {});
      return engine.start(overrides);
    } catch (err) {
      const { statusCode, body } = errorReply(err);
      return reply.code(statusCode).send(body);
    }
  });

  const action =
    (fn: () => ReturnType<SessionEngine["getSnapshot"]>) =>
    async (
      _req: unknown,
      reply: { code: (n: number) => { send: (b: object) => unknown } },
    ) => {
      try {
        return fn();
      } catch (err) {
        const { statusCode, body } = errorReply(err);
        return reply.code(statusCode).send(body);
      }
    };

  app.post("/api/session/ack-rest", action(() => engine.ackRest()));
  app.post("/api/session/continue", action(() => engine.continueExtended()));
  app.post("/api/session/start-rest", action(() => engine.startRest()));
  app.post("/api/session/soft-pause", action(() => engine.softPause()));
  app.post("/api/session/soft-resume", action(() => engine.softResume()));
  app.post("/api/session/end-long-rest", action(() => engine.endLongRest()));
}
