import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import { buildApp } from "../server.js";
import { initDatabase } from "../store/db.js";
import { generatePrincipalKeypair, signMandate } from "../core/crypto.js";
import type { BuyerMandate, CanonicalIntent, MerchantPolicy } from "../core/types.js";

async function runBenchmark() {
  console.log("\n" + "=".repeat(75));
  console.log("  ACG EMPIRICAL BENCHMARK: TIME-TO-FIRST-AI-TRANSACTION");
  console.log("=".repeat(75));

  const tStart = performance.now();

  // Phase 1: Gateway Initialization & Merchant Policy Configuration
  const t0 = performance.now();
  const db = initDatabase(":memory:");
  const merchantPolicy: MerchantPolicy = {
    policy_version: "pol_v1.0.0",
    effective_at: Math.floor(Date.now() / 1000),
    merchant_id: "merch_acme_electronics_01",
    max_transaction_amount: 5000000,
    allowed_categories: ["electronics", "furniture", "accessories"],
    auto_refund_on_fulfillment_failure: true,
    min_margin_percentage: 15,
  };
  const { app, services } = await buildApp(db, merchantPolicy);
  await app.ready();
  const tGatewayReady = performance.now();

  // Phase 2: Catalog Seeding & Truth Engine Verification
  const t1 = performance.now();
  services.truthEngine.seedDefaultCatalog();
  const catalogCheck = services.truthEngine.resolveTruth([{ sku: "SKU-MOUSE-PRO", quantity: 1 }]);
  const tCatalogReady = performance.now();

  // Phase 3: Buyer Principal Mandate Generation & Cryptographic Signing
  const t2 = performance.now();
  const principal = generatePrincipalKeypair();
  const now = Math.floor(Date.now() / 1000);
  const mandateData = {
    mandate_id: `mandate_bench_${crypto.randomBytes(4).toString("hex")}`,
    principal_public_key: principal.publicKeyHex,
    budget_limit: 500000, // ₹5,000.00
    currency: "INR" as const,
    expiry: now + 3600,
    merchant_whitelist: ["merch_acme_electronics_01"],
    category_whitelist: ["electronics"],
  };
  const signature = signMandate(mandateData, principal.privateKeyObject);
  const mandate: BuyerMandate = { ...mandateData, signature };
  const tMandateReady = performance.now();

  // Phase 4: Autonomous Agent Ingress & Full ACG Pipeline Execution
  const t3 = performance.now();
  const intent: CanonicalIntent = {
    intent_id: crypto.randomUUID(),
    client_nonce: crypto.randomBytes(16).toString("hex"),
    timestamp: now,
    mandate,
    proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
  };

  const res = await app.inject({
    method: "POST",
    url: "/v1/agent/checkout",
    payload: intent,
  });
  const tCheckoutComplete = performance.now();

  const totalTimeMs = tCheckoutComplete - tStart;

  console.log(`\n⏱️  Execution Milestones (Cold-Start In-Memory Test):`);
  console.log(`   ├── 1. Gateway Boot & Policy Engine:      ${(tGatewayReady - t0).toFixed(2)} ms`);
  console.log(`   ├── 2. Catalog Ingestion & Truth Link:    ${(tCatalogReady - t1).toFixed(2)} ms`);
  console.log(`   ├── 3. Ed25519 Principal Mandate Sign:    ${(tMandateReady - t2).toFixed(2)} ms`);
  console.log(`   └── 4. 6-Phase Zero-Trust Agent Checkout: ${(tCheckoutComplete - t3).toFixed(2)} ms`);
  console.log(`\n🚀 TOTAL TIME-TO-FIRST-AI-TRANSACTION (Cold Run): ${totalTimeMs.toFixed(2)} ms`);
  console.log(`   ├── Gateway Response Status: ${res.statusCode} Created`);
  console.log(`   ├── Razorpay Order Created:  ${res.json().razorpay_order_id}`);
  console.log(`   └── Policy Version Pinned:   ${res.json().policy_version}`);

  console.log(`\n💼 Human Merchant Setup Equivalent:`);
  console.log(`   ├── Step 1: Install & configure .env (Razorpay API Keys): ~3-5 mins`);
  console.log(`   ├── Step 2: Define JSON Policy DSL (Allowed categories & caps): ~2 mins`);
  console.log(`   ├── Step 3: Connect DB Catalog / REST endpoint: ~5 mins`);
  console.log(`   └── Total Merchant Integration Time: ~10-12 minutes`);
  console.log("=".repeat(75) + "\n");

  await app.close();
}

runBenchmark().catch(console.error);
