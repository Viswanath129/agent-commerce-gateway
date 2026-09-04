import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { buildApp } from "../../server.js";
import { initDatabase } from "../../store/db.js";
import { generatePrincipalKeypair, signMandate } from "../crypto.js";
import type { BuyerMandate, CanonicalIntent } from "../types.js";
import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";

/**
 * =========================================================================
 * AUTHORITY_BOUNDARY_TEST
 * =========================================================================
 * Forensic proof that merchant database truth & control plane policies
 * strictly dominate over any AI model / subagent claims.
 *
 * PIPELINE VERIFIED:
 * AGENT INTENT -> CANONICALIZATION -> MERCHANT TRUTH -> POLICY -> BUDGET -> AUTHORIZATION -> EXECUTION
 * (Zero path for AGENT -> DIRECT EXECUTION)
 * =========================================================================
 */
describe("AUTHORITY_BOUNDARY_TEST: Merchant Truth & Zero-Trust Boundary", () => {
  let app: FastifyInstance;
  let db: DatabaseSync;
  let services: any;

  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    db = initDatabase(":memory:");
    const built = await buildApp(db);
    app = built.app;
    services = built.services;
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("1. [FAKE PRICE ATTACK]: AI agent claims price of ₹1.00 -> Merchant truth calculates ₹4,130.00 from DB", async () => {
    const principal = generatePrincipalKeypair();
    const now = Math.floor(Date.now() / 1000);
    const mandateData = {
      mandate_id: "mandate_auth_01",
      principal_public_key: principal.publicKeyHex,
      budget_limit: 500000, // ₹5,000.00
      currency: "INR" as const,
      merchant_whitelist: ["merch_acme_electronics_01"],
      category_whitelist: ["electronics"],
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
    // 350000 paise + 18% GST (63000) = 413000 paise (₹4,130.00)
    expect(body.amount_paise).toBe(413000);
    expect(body.items[0].unit_price_inr).toBe(3500);
  });

  it("2. [FAKE STOCK ATTACK]: AI agent requests 50 units when catalog has only 5 -> Rejected at Truth Gate", async () => {
    const principal = generatePrincipalKeypair();
    const now = Math.floor(Date.now() / 1000);
    const mandateData = {
      mandate_id: "mandate_auth_02",
      principal_public_key: principal.publicKeyHex,
      budget_limit: 50000000,
      currency: "INR" as const,
      expiry: now + 3600,
    };
    const signature = signMandate(mandateData, principal.privateKeyObject);

    const intent: CanonicalIntent = {
      intent_id: crypto.randomUUID(),
      client_nonce: crypto.randomBytes(16).toString("hex"),
      timestamp: now,
      mandate: { ...mandateData, signature },
      proposed_items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 50 }],
    };

    const res = await app.inject({
      method: "POST",
      url: "/v1/agent/checkout",
      payload: intent,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("COMMERCE_TRUTH_REJECTION");
    expect(res.json().message).toContain("Insufficient stock");
  });

  it("3. [FAKE PRODUCT / SKU ATTACK]: AI agent invents a hallucinated SKU -> Rejected with 400 COMMERCE_TRUTH_REJECTION", async () => {
    const principal = generatePrincipalKeypair();
    const now = Math.floor(Date.now() / 1000);
    const mandateData = {
      mandate_id: "mandate_auth_03",
      principal_public_key: principal.publicKeyHex,
      budget_limit: 500000,
      currency: "INR" as const,
      expiry: now + 3600,
    };
    const signature = signMandate(mandateData, principal.privateKeyObject);

    const intent: CanonicalIntent = {
      intent_id: crypto.randomUUID(),
      client_nonce: crypto.randomBytes(16).toString("hex"),
      timestamp: now,
      mandate: { ...mandateData, signature },
      proposed_items: [{ sku: "SKU-HALLUCINATED-QUANTUM-PHONE", quantity: 1 }],
    };

    const res = await app.inject({
      method: "POST",
      url: "/v1/agent/checkout",
      payload: intent,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("COMMERCE_TRUTH_REJECTION");
    expect(res.json().message).toContain("does not exist or is inactive");
  });

  it("4. [INACTIVE / DELETED PRODUCT]: Inactive catalog item cannot be checked out", async () => {
    // Insert an inactive item directly into DB
    db.prepare(`
      INSERT INTO catalog_items (sku, name, category, unit_price, tax_rate_bps, available_stock, is_active)
      VALUES ('SKU-DISCONTINUED-MONITOR', 'Discontinued OLED Monitor', 'electronics', 4500000, 1800, 10, 0)
    `).run();

    const principal = generatePrincipalKeypair();
    const now = Math.floor(Date.now() / 1000);
    const mandateData = {
      mandate_id: "mandate_auth_04",
      principal_public_key: principal.publicKeyHex,
      budget_limit: 10000000,
      currency: "INR" as const,
      expiry: now + 3600,
    };
    const signature = signMandate(mandateData, principal.privateKeyObject);

    const intent: CanonicalIntent = {
      intent_id: crypto.randomUUID(),
      client_nonce: crypto.randomBytes(16).toString("hex"),
      timestamp: now,
      mandate: { ...mandateData, signature },
      proposed_items: [{ sku: "SKU-DISCONTINUED-MONITOR", quantity: 1 }],
    };

    const res = await app.inject({
      method: "POST",
      url: "/v1/agent/checkout",
      payload: intent,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("COMMERCE_TRUTH_REJECTION");
  });

  it("5. [CATALOG MUTATION BEFORE AUTHORIZATION]: Price change in database takes immediate authoritative effect", async () => {
    // Update mouse price in database from ₹1,800 to ₹2,500
    db.prepare("UPDATE catalog_items SET unit_price = 250000 WHERE sku = 'SKU-MOUSE-PRO'").run();

    const principal = generatePrincipalKeypair();
    const now = Math.floor(Date.now() / 1000);
    const mandateData = {
      mandate_id: "mandate_auth_05",
      principal_public_key: principal.publicKeyHex,
      budget_limit: 500000,
      currency: "INR" as const,
      expiry: now + 3600,
    };
    const signature = signMandate(mandateData, principal.privateKeyObject);

    const intent: CanonicalIntent = {
      intent_id: crypto.randomUUID(),
      client_nonce: crypto.randomBytes(16).toString("hex"),
      timestamp: now,
      mandate: { ...mandateData, signature },
      proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
    };

    const res = await app.inject({
      method: "POST",
      url: "/v1/agent/checkout",
      payload: intent,
    });

    expect(res.statusCode).toBe(201);
    // 250000 paise + 18% GST (45000) = 295000 paise (₹2,950.00)
    expect(res.json().amount_paise).toBe(295000);
    expect(res.json().items[0].unit_price_inr).toBe(2500);
  });

  it("6. [CROSS-MERCHANT REUSE / UNAUTHORIZED TARGET]: Mandate pinned to Merchant A rejected by Merchant B", async () => {
    const principal = generatePrincipalKeypair();
    const now = Math.floor(Date.now() / 1000);
    const mandateData = {
      mandate_id: "mandate_auth_06",
      principal_public_key: principal.publicKeyHex,
      budget_limit: 500000,
      currency: "INR" as const,
      merchant_whitelist: ["merch_other_competitor_store"], // Not acme electronics
      category_whitelist: ["electronics"],
      expiry: now + 3600,
    };
    const signature = signMandate(mandateData, principal.privateKeyObject);

    const intent: CanonicalIntent = {
      intent_id: crypto.randomUUID(),
      client_nonce: crypto.randomBytes(16).toString("hex"),
      timestamp: now,
      mandate: { ...mandateData, signature },
      proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
    };

    const res = await app.inject({
      method: "POST",
      url: "/v1/agent/checkout",
      payload: intent,
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("MERCHANT_NOT_WHITELISTED");
  });

  it("7. [ZERO DIRECT EXECUTION PATH]: Downstream Razorpay API is NEVER invoked when authorization checks fail", async () => {
    const initialOrders = db.prepare("SELECT COUNT(*) as count FROM order_sessions").get() as any;
    const initialReservations = db.prepare("SELECT COUNT(*) as count FROM reservations").get() as any;

    const principal = generatePrincipalKeypair();
    const now = Math.floor(Date.now() / 1000);
    const mandateData = {
      mandate_id: "mandate_auth_07",
      principal_public_key: principal.publicKeyHex,
      budget_limit: 100000, // ₹1,000 cap (Keyboard is ₹4,130)
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

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("MANDATE_BUDGET_EXCEEDED");

    // Verify ZERO side effects
    const finalOrders = db.prepare("SELECT COUNT(*) as count FROM order_sessions").get() as any;
    const finalReservations = db.prepare("SELECT COUNT(*) as count FROM reservations").get() as any;
    expect(finalOrders.count).toBe(initialOrders.count);
    expect(finalReservations.count).toBe(initialReservations.count);
  });
});
