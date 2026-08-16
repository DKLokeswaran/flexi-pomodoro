import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  type SessionSnapshot,
  type StartSessionBody,
  SESSION_API,
  parseStartSessionBody,
} from "@flexi-pomodoro/shared";
import type { SettingsService } from "../services/settings.service.js";
import { SessionService } from "../services/session.service.js";
import { errorReply } from "../utils/errorReply.js";

/** Parse a query/body watermark; missing or invalid values become 0. */
function parseSinceSeq(rawSinceSeq: unknown): number {
  const parsed =
    typeof rawSinceSeq === "string"
      ? Number(rawSinceSeq)
      : typeof rawSinceSeq === "number"
        ? rawSinceSeq
        : 0;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

/** Missing/zero watermark → current high-water (no history replay). */
function resolveSinceSeq(
  rawSinceSeq: unknown,
  session: SessionService,
): number {
  const parsed = parseSinceSeq(rawSinceSeq);
  return parsed > 0 ? parsed : session.getAlertSeq();
}

/** Hijack the reply and write SSE headers for a live session stream. */
function openSseReply(reply: FastifyReply): void {
  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
}

/** Serialize one snapshot as a Server-Sent Event data frame. */
function writeSseSnapshot(
  reply: FastifyReply,
  snapshot: SessionSnapshot,
): void {
  reply.raw.write(`data: ${JSON.stringify(snapshot)}\n\n`);
}

/** Wrap a session mutation so domain errors become HTTP error replies. */
function sessionAction(
  runAction: () => SessionSnapshot,
): (req: FastifyRequest, reply: FastifyReply) => Promise<unknown> {
  return async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      return runAction();
    } catch (error) {
      const { statusCode, body } = errorReply(error);
      return reply.code(statusCode).send(body);
    }
  };
}

/** REST + SSE endpoints for reading and mutating the in-memory session. */
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
      openSseReply(reply);

      const sinceSeq = resolveSinceSeq(req.query.sinceSeq, session);
      writeSseSnapshot(reply, session.getSnapshot(Date.now(), sinceSeq));

      const unsubscribe = session.subscribe((snapshot) => {
        writeSseSnapshot(reply, snapshot);
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

  app.post<{ Body: StartSessionBody }>(
    SESSION_API.start,
    async (req, reply) => {
      try {
        const { debug, overrides } = parseStartSessionBody(req.body ?? {});
        const params = settings.resolveSessionParams(overrides, debug);
        return session.start(params, Date.now());
      } catch (error) {
        const { statusCode, body } = errorReply(error);
        return reply.code(statusCode).send(body);
      }
    },
  );

  app.post(
    SESSION_API.ackRest,
    sessionAction(() => session.ackRest()),
  );
  app.post(
    SESSION_API.continue,
    sessionAction(() => session.continueExtended()),
  );
  app.post(
    SESSION_API.startRest,
    sessionAction(() => session.startRest()),
  );
  app.post(
    SESSION_API.softPause,
    sessionAction(() => session.softPause()),
  );
  app.post(
    SESSION_API.softResume,
    sessionAction(() => session.softResume()),
  );
  app.post(
    SESSION_API.endLongRest,
    sessionAction(() => session.endLongRest()),
  );
}
