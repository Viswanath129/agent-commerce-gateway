import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { buildApp } from "../../server.js";
import { initDatabase } from "../../store/db.js";
import { generatePrincipalKeypair, signMandate, verifyMandateSignature } from "../crypto.js";
import type { BuyerMandate, CanonicalIntent } from "../types.js";
import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";

describe("Agent Commerce Gateway (ACG) — Core Test Suite", () => {
  let app: FastifyInstance;
  let db: DatabaseSync;

  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    db = initDatabase(":memory:");
    const built = await buildApp(db);
    app = built.app;
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("Crypto: Should generate, sign, and verify valid Ed25519 mandates", () => {
    const principal = generatePrincipalKeypair();
    const mandateData = {
      mandate_id: "mandate_test_123",
      principal_public_key: principal.publicKeyHex,
      budget_limit: 500000,
      currency: "INR" as const,
      merchant_whitelist: ["merch_test_1"],
      category_whitelist: ["electronics"],
      expiry: Math.floor(Date.now() / 1000) + 3600,
    };

    const signature = signMandate(mandateData, principal.privateKeyObject);
    const validMandate: BuyerMandate = { ...mandateData, signature };

    expect(verifyMandateSignature(validMandate)).toBe(true);

    // Tamper with budget
    const tamperedMandate: BuyerMandate = { ...validMandate, budget_limit: 99999999 };
    expect(verifyMandateSignature(tamperedMandate)).toBe(false);
  });

  it("Commerce Truth: Should calculate real price from DB and ignore LLM pricing", async () => {
    const principal = generatePrincipalKeypair();
    const now = Math.floor(Date.now() / 1000);
    const mandateData = {
      mandate_id: "mandate_truth_1",
      principal_public_key: principal.publicKeyHex,
      budget_limit: 500000, // INR 5,000.00
      currency: "INR" as const,
      expiry: now + 3600,
    };
    const signature = signMandate(mandateData, principal.privateKeyObject);

    const intent: CanonicalIntent = {
      intent_id: crypto.randomUUID(),
      client_nonce: crypto.randomBytes(16).toString("hex"),
      timestamp: now,
      mandate: { ...mandateData, signature },
      proposed_items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 1 }],
    };

    const res = await app.inject({
      method: "POST",
      url: "/v1/agent/checkout",
      payload: intent,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.amount_paise).toBe(413000); // 3500 + 18% GST (630) = 4130.00
    expect(body.status).toBe("ORDER_CREATED");
  });

  it("Concurrency: Should prevent double-spending across parallel subagents", async () => {
    const principal = generatePrincipalKeypair();
    const now = Math.floor(Date.now() / 1000);
    const mandateData = {
      mandate_id: `mandate_race_${crypto.randomBytes(4).toString("hex")}`,
      principal_public_key: principal.publicKeyHex,
      budget_limit: 500000, // INR 5,000.00
      currency: "INR" as const,
      expiry: now + 3600,
    };
    const signature = signMandate(mandateData, principal.privateKeyObject);

    const intentA: CanonicalIntent = {
      intent_id: crypto.randomUUID(),
      client_nonce: crypto.randomBytes(16).toString("hex"),
      timestamp: now,
      mandate: { ...mandateData, signature },
      proposed_items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 1 }],
    };

    const intentB: CanonicalIntent = {
      intent_id: crypto.randomUUID(),
      client_nonce: crypto.randomBytes(16).toString("hex"),
      timestamp: now,
      mandate: { ...mandateData, signature },
      proposed_items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 1 }],
    };

    const [resA, resB] = await Promise.all([
      app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intentA }),
      app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intentB }),
    ]);

    const statuses = [resA.statusCode, resB.statusCode];
    expect(statuses).toContain(201);
    expect(statuses).toContain(409); // One succeeds, one rejected with 409
  });
});
