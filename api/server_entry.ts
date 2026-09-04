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

    // Read body buffer if present
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const payload = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

    const response = await app.inject({
      method: (req.method || "GET") as any,
      url: req.url || "/",
      headers: req.headers as any,
      payload: payload,
    });

    res.statusCode = response.statusCode;
    for (const [header, val] of Object.entries(response.headers)) {
      if (val !== undefined) {
        res.setHeader(header, val);
      }
    }
    res.end(response.rawPayload);
  } catch (err: any) {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        error: "SERVERLESS_HANDLER_ERROR",
        message: err?.message || String(err)
      }));
    }
  }
}
