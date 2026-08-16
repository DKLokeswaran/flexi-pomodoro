import { buildApp } from "./app.js";

/** Process entry: bind Fastify on PORT/HOST (defaults 3847 / 0.0.0.0). */
const port = Number(process.env.PORT ?? 3847);
const host = process.env.HOST ?? "0.0.0.0";
const { app } = await buildApp();
await app.listen({ port, host });
