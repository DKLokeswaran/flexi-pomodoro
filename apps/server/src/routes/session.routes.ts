import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  type SessionSnapshot,
  type StartSessionBody,
  SESSION_API,
  parseStartSessionBody,
} from "@flexi-pomodoro/shared";
import { ZodError } from "zod";
import {
  SettingsError,
  toSettingsError,
  type SettingsService,
} from "../services/settings.service.js";
import { SessionError, SessionService } from "../services/session.service.js";

function errorReply(err: unknown): { statusCode: number; body: object } {
  if (err instanceof ZodError) {
    return errorReply(toSettingsError(err));
  }
  if (err instanceof SettingsError) {
    return {
      statusCode: 400,
      body: { error: err.message, code: err.code },
    };
  }
  if (err instanceof SessionError) {
    const status =
      err.code === "NO_SESSION" || err.code === "SESSION_ACTIVE"
        ? 409
        : err.code === "FORBIDDEN" || err.code === "PARAMS_LOCKED"
          ? 403
          : 400;
    return {
      statusCode: status,
      body: { error: err.message, code: err.code },
    };
  }
  throw err;
}

function parseSinceSeq(raw: unknown): number {
  const n = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : 0;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Missing/zero watermark → current high-water (no history replay). */
function resolveSinceSeq(raw: unknown, session: SessionService): number {
  const parsed = parseSinceSeq(raw);
  return parsed > 0 ? parsed : session.getAlertSeq();
}

export function registerSessionRoutes(
  app: FastifyInstance,
  { settings, session }: { settings: SettingsService; session: SessionService },
): void {
  app.get(SESSION_API.alertSeq, async () => ({
    alertSeq: session.getAlertSeq(),
  }));

  app.get<{ Querystring: { sinceSeq?: string } }>(
    SESSION_API.session,
    async (req) => {
      const sinceSeq = resolveSinceSeq(req.query.sinceSeq, session);
      return session.getSnapshot(Date.now(), sinceSeq);
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

      const sinceSeq = resolveSinceSeq(req.query.sinceSeq, session);
      send(session.getSnapshot(Date.now(), sinceSeq));

      const unsubscribe = session.subscribe((snapshot) => {
        send(snapshot);
      }, session.getAlertSeq());

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
      const params = settings.resolveSessionParams(overrides, debug);
      return session.start(params, Date.now());
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

  app.post(SESSION_API.ackRest, action(() => session.ackRest()));
  app.post(SESSION_API.continue, action(() => session.continueExtended()));
  app.post(SESSION_API.startRest, action(() => session.startRest()));
  app.post(SESSION_API.softPause, action(() => session.softPause()));
  app.post(SESSION_API.softResume, action(() => session.softResume()));
  app.post(SESSION_API.endLongRest, action(() => session.endLongRest()));
}
