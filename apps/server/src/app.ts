import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./db/index.js";
import { SettingsService } from "./services/settings.service.js";
import { SessionService } from "./services/session.service.js";
import { registerRoutes } from "./routes/index.js";
import { IntervalScheduler } from "./scheduler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Resolve candidate web dist folders (env, relative, cwd) to absolute paths. */
function webDistCandidates(): string[] {
  return [
    process.env.WEB_DIST,
    path.resolve(__dirname, "../../web/dist"),
    path.resolve(__dirname, "../../../web/dist"),
    path.resolve(process.cwd(), "apps/web/dist"),
  ]
    .filter((candidate): candidate is string => Boolean(candidate))
    .map((candidate) => path.resolve(candidate));
}

/** Serve the built web app if a dist folder exists; SPA fallback except /api. */
async function registerWebStatic(app: FastifyInstance): Promise<void> {
  const webDist = webDistCandidates().find((candidate) =>
    existsSync(candidate),
  );
  if (!webDist) return;

  await app.register(fastifyStatic, {
    root: webDist,
    prefix: "/",
    wildcard: false,
  });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api/")) {
      return reply.code(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html");
  });
}

/** Wire DB, settings hydrate, session, routes, tick scheduler, optional static UI. */
export async function buildApp() {
  const app = Fastify({ logger: true });
  const { db, stores } = await openDatabase();
  const settings = new SettingsService(stores.settings);
  await settings.hydrate();
  const session = new SessionService();

  await registerRoutes(app, { settings, session });

  const scheduler = new IntervalScheduler({
    intervalMs: 250,
    onTick: async (nowMs) => {
      await session.tickIfIdle(nowMs, true);
    },
  });
  scheduler.start();

  app.addHook("onClose", async () => {
    scheduler.stop();
    await db.destroy();
  });

  await registerWebStatic(app);

  return { app };
}
