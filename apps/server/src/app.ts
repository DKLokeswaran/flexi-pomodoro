import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SettingsService } from "./services/settings.service.js";
import { SessionService } from "./services/session.service.js";
import { registerRoutes } from "./routes/index.js";
import { IntervalScheduler } from "./scheduler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildApp() {
  const app = Fastify({ logger: true });
  const settings = new SettingsService();
  const session = new SessionService();

  await registerRoutes(app, { settings, session });

  const scheduler = new IntervalScheduler({
    intervalMs: 250,
    onTick: (nowMs) => session.tick(nowMs, true),
  });
  scheduler.start();

  app.addHook("onClose", async () => {
    scheduler.stop();
  });

  const webDistCandidates = [
    process.env.WEB_DIST,
    path.resolve(__dirname, "../../web/dist"),
    path.resolve(__dirname, "../../../web/dist"),
    path.resolve(process.cwd(), "apps/web/dist"),
  ]
    .filter((p): p is string => Boolean(p))
    .map((p) => path.resolve(p));

  const webDist = webDistCandidates.find((p) => existsSync(p));
  if (webDist) {
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

  return { app, settings, session, scheduler };
}
