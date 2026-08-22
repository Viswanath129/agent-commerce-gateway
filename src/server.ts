import Fastify from "fastify";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { initDatabase, type SqliteDatabase } from "./store/db.js";
import { registerGatewayRoutes } from "./gateway/router.js";
import type { MerchantPolicy } from "./core/types.js";

dotenv.config();

const port = Number.parseInt(process.env.PORT || "3000", 10);
const host = process.env.HOST || "0.0.0.0";

export const defaultPolicy: MerchantPolicy = {
  policy_version: "pol_v1.0.0",
  effective_at: 1771737600, // 2026-02-22
  merchant_id: process.env.MERCHANT_ID || "merch_acme_electronics_01",
  max_transaction_amount: 5000000, // INR 50,000.00
  allowed_categories: ["electronics", "furniture", "accessories"],
  auto_refund_on_fulfillment_failure: true,
  min_margin_percentage: 15,
};

export async function buildApp(customDb?: SqliteDatabase, customPolicy?: MerchantPolicy) {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "test" ? "silent" : "info",
    },
  });

  const dbPath = process.env.DATABASE_PATH || "./data/acg_gateway.db";
  const db = customDb || initDatabase(dbPath);
  const policy = customPolicy || defaultPolicy;
  const services = registerGatewayRoutes(app, db, policy);

  return { app, db, services };
}

async function main() {
  const { app } = await buildApp();
  try {
    await app.listen({ port, host });
    console.log(`\n🚀 AGENT COMMERCE GATEWAY (ACG) running at http://${host}:${port}`);
    console.log(`🛡️  Merchant Control Plane ready for Razorpay Track 01\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
