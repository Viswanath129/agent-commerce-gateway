import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../src/server.js";

let fastifyAppPromise: Promise<any> | null = null;

async function getFastifyApp() {
  if (!fastifyAppPromise) {
    fastifyAppPromise = (async () => {
      process.env.VERCEL = "1";
      if (!process.env.DATABASE_PATH) {
        process.env.DATABASE_PATH = "/tmp/acg_gateway.db";
      }
      try {
        const { app } = await buildApp();
        await app.ready();
        return app;
      } catch (err) {
        console.error("Fastify initialization error on Vercel:", err);
        throw err;
      }
    })();
  }
  return fastifyAppPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getFastifyApp();
    app.server.emit("request", req, res);
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      error: "FUNCTION_INITIALIZATION_ERROR",
      message: err?.message || String(err)
    }));
  }
}
