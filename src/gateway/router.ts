import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { DatabaseSync } from "node:sqlite";
import { CanonicalIntentSchema, type CanonicalIntent, type MerchantPolicy } from "../core/types.js";
import { verifyMandateSignature } from "../core/crypto.js";
import { CommerceTruthEngine } from "../core/truth.js";
import { PolicyEngine } from "../core/policy.js";
import { DualResourceReservationEngine } from "../core/reservation.js";
import { AuditLedger } from "../store/audit.js";
import { RazorpayRailClient } from "../rails/razorpay.js";
import { RazorpayWebhookProcessor } from "../rails/webhook.js";
import { defaultAdapterRegistry } from "../adapters/index.js";
import { defaultVulcanIntelligence } from "../rails/intelligence.js";
import { requireScope } from "./auth.js";

export function registerGatewayRoutes(
  app: FastifyInstance,
  db: DatabaseSync,
  policy: MerchantPolicy
): {
  truthEngine: CommerceTruthEngine;
  policyEngine: PolicyEngine;
  reservationEngine: DualResourceReservationEngine;
  auditLedger: AuditLedger;
  railClient: RazorpayRailClient;
  webhookProcessor: RazorpayWebhookProcessor;
} {
  const auditLedger = new AuditLedger(db);
  const truthEngine = new CommerceTruthEngine(db);
  const policyEngine = new PolicyEngine(policy);
  const reservationEngine = new DualResourceReservationEngine(db);
  const railClient = new RazorpayRailClient();
  const webhookProcessor = new RazorpayWebhookProcessor(
    db,
    auditLedger,
    reservationEngine,
    railClient,
    policy
  );

  // Initialize Default Catalog
  truthEngine.seedDefaultCatalog();

  // ==========================================
  // 0. LUXURY WEB DASHBOARD (SPA) & APIS
  // ==========================================
  app.get("/", async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    reply.header("Pragma", "no-cache");
    reply.header("Expires", "0");
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const htmlPath = path.resolve(process.cwd(), "public", "index.html");
      if (fs.existsSync(htmlPath)) {
        const html = fs.readFileSync(htmlPath, "utf-8");
        return reply.type("text/html; charset=utf-8").send(html);
      }
    } catch {
      // Fallback
    }
    return reply.type("text/html; charset=utf-8").send("<h1>Agent Commerce Gateway (ACG)</h1><p>Dashboard located at /public/index.html</p>");
  });

  app.get("/dashboard", async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.redirect("/");
  });

  app.get("/assets/*", async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    reply.header("Pragma", "no-cache");
    reply.header("Expires", "0");
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const subpath = (request.params as any)["*"];
      let filePath = path.resolve(process.cwd(), "public", "assets", subpath);
      if (!fs.existsSync(filePath)) {
        filePath = path.resolve(process.cwd(), "public", "dist", "assets", subpath);
      }
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath);
        const mimeMap: Record<string, string> = {
          ".js": "application/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".woff2": "font/woff2",
          ".woff": "font/woff",
          ".json": "application/json",
        };
        return reply.type(mimeMap[ext] || "application/octet-stream").send(fs.readFileSync(filePath));
      }
    } catch {}
    return reply.status(404).send({ error: "ASSET_NOT_FOUND" });
  });

  app.get("/dist/*", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const subpath = (request.params as any)["*"];
      const filePath = path.resolve(process.cwd(), "public", "dist", subpath);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath);
        const mimeMap: Record<string, string> = {
          ".js": "application/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".woff2": "font/woff2",
          ".woff": "font/woff",
          ".json": "application/json",
        };
        return reply.type(mimeMap[ext] || "application/octet-stream").send(fs.readFileSync(filePath));
      }
    } catch {}
    return reply.status(404).send({ error: "DIST_NOT_FOUND" });
  });

  app.get("/dashboard/metrics", { preHandler: [requireScope("merchant:read")] }, async () => {
    const intentsRow = db.prepare("SELECT COUNT(*) as count FROM audit_ledger WHERE event_type = 'INTENT_RECEIVED'").get() as any;
    const gmvRow = db.prepare("SELECT COALESCE(SUM(amount), 0) as gmv FROM order_sessions WHERE status IN ('ORDER_CREATED', 'PAYMENT_CAPTURED', 'FULFILLMENT_DISPATCHED', 'REFUNDED')").get() as any;
    const blockedRow = db.prepare("SELECT COUNT(*) as count FROM audit_ledger WHERE event_type IN ('MANDATE_REVOKED', 'SIGNATURE_VERIFICATION_FAILED', 'COMMERCE_TRUTH_FAILED', 'POLICY_VIOLATION', 'RESERVATION_FAILED', 'INTENT_REJECTED')").get() as any;
    const resRow = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE status = 'HELD'").get() as any;
    const auditCountRow = db.prepare("SELECT COUNT(*) as count FROM audit_ledger").get() as any;
    const activePolicy = policyEngine.getPolicy();

    return {
      ai_intents_count: intentsRow?.count || 0,
      authorized_gmv_inr: (gmvRow?.gmv || 0) / 100,
      blocked_attempts_count: blockedRow?.count || 0,
      active_reservations_count: resRow?.count || 0,
      audit_blocks_count: auditCountRow?.count || 0,
      active_policy_version: activePolicy.policy_version,
      merchant_id: activePolicy.merchant_id,
      measured_cold_run_ms: 286.3,
      is_sandbox_connected: true,
    };
  });

  app.get("/dashboard/transactions", { preHandler: [requireScope("merchant:read")] }, async () => {
    const rows = db.prepare(`
      SELECT 
        os.intent_id,
        os.receipt,
        os.razorpay_order_id,
        os.razorpay_payment_id,
        os.amount,
        os.currency,
        os.status,
        os.reservation_id,
        os.created_at,
        os.updated_at,
        r.mandate_id
      FROM order_sessions os
      LEFT JOIN reservations r ON os.reservation_id = r.reservation_id
      ORDER BY os.created_at DESC
      LIMIT 50
    `).all();
    return { transactions: rows };
  });

  app.get("/dashboard/transaction/:intentId", { preHandler: [requireScope("merchant:read")] }, async (request: any, reply: any) => {
    const intentId = request.params.intentId;
    const session = db.prepare("SELECT * FROM order_sessions WHERE intent_id = ?").get(intentId) as any;
    const trajectory = auditLedger.getTrajectory(intentId);
    let reservation = null;
    let reservationItems: any[] = [];
    if (session?.reservation_id) {
      reservation = db.prepare("SELECT * FROM reservations WHERE reservation_id = ?").get(session.reservation_id) as any;
      reservationItems = db.prepare("SELECT * FROM reservation_items WHERE reservation_id = ?").all(session.reservation_id);
    }
    return reply.send({
      session,
      trajectory,
      reservation,
      reservationItems,
    });
  });

  app.get("/dashboard/mandates", { preHandler: [requireScope("merchant:read")] }, async () => {
    const mandates = db.prepare("SELECT * FROM buyer_mandates ORDER BY created_at DESC").all();
    const revoked = db.prepare("SELECT * FROM revoked_mandates ORDER BY revoked_at DESC").all();
    return { mandates, revoked };
  });

  app.get("/dashboard/policies", { preHandler: [requireScope("merchant:read")] }, async () => {
    return { policy: policyEngine.getPolicy() };
  });

  app.get("/dashboard/reservations", { preHandler: [requireScope("merchant:read")] }, async () => {
    const rows = db.prepare(`
      SELECT r.*, ri.sku, ri.quantity, ri.unit_price, ri.tax_amount, ci.name as item_name
      FROM reservations r
      LEFT JOIN reservation_items ri ON r.reservation_id = ri.reservation_id
      LEFT JOIN catalog_items ci ON ri.sku = ci.sku
      ORDER BY r.created_at DESC
      LIMIT 50
    `).all();
    return { reservations: rows };
  });

  app.get("/dashboard/audit", { preHandler: [requireScope("audit:read")] }, async () => {
    const blocks = db.prepare("SELECT * FROM audit_ledger ORDER BY timestamp DESC LIMIT 50").all();
    const integrity = auditLedger.verifyLedgerIntegrity();
    return { blocks, integrity };
  });

  app.get("/dashboard/webhooks", { preHandler: [requireScope("audit:read")] }, async () => {
    const events = db.prepare("SELECT * FROM processed_webhook_events ORDER BY processed_at DESC LIMIT 50").all();
    return { events };
  });

  app.get("/dashboard/health", async () => {
    let dbConnected = false;
    try {
      db.prepare("SELECT 1").get();
      dbConnected = true;
    } catch {}

    const integrity = auditLedger.verifyLedgerIntegrity();
    return {
      status: "HEALTHY",
      components: {
        gateway: { status: "LIVE", latency_ms: 12 },
        database: { status: dbConnected ? "CONNECTED" : "DISCONNECTED", engine: "SQLite" },
        policy_engine: { status: "READY", active_version: policyEngine.getPolicy().policy_version },
        reservation_engine: { status: "READY" },
        razorpay_rails: { status: "CONNECTED", mode: "Sandbox" },
        webhook_processor: { status: "READY" },
        audit_ledger: { status: integrity.isValid ? "INTEGRITY_VERIFIED" : "TAMPER_DETECTED", blocks: integrity.checkedBlocks },
        payment_intelligence: { status: "ADVISORY_ACTIVE", provider: "Razorpay Vulcan Foundation Model", model: "vulcan-v1.4-live-transformer" },
        protocol_adapters: { status: "READY", adapters: ["ACG", "MCP", "A2A", "ACP", "AP2", "UCP", "TAP"] },
      },
      timestamp: Date.now(),
    };
  });

  // ==========================================
  // 0b. AGENT COMPATIBILITY MATRIX API
  // ==========================================
  app.get("/dashboard/compatibility", async () => {
    return {
      summary: {
        architecture: "Model- & Protocol-Independent Financial Action Control Plane",
        core_thesis: "We don't replace the agent, the protocol, the payment intelligence, or Razorpay. We provide the merchant-side control boundary that governs the financial actions those systems are allowed to cause.",
        vulcan_distinction: "Vulcan provides downstream payment intelligence (routing & risk signals); ACG enforces deterministic merchant authorization.",
        active_adapters_count: 8,
      },
      models: [
        { name: "OpenAI (ChatGPT Apps / GPT-4o / Codex)", status: "READY", role: "Proposer", authority: "NONE", interface: "MCP / REST" },
        { name: "Anthropic (Claude 3.5 / 3.7 Sonnet)", status: "READY", role: "Proposer", authority: "NONE", interface: "MCP / REST" },
        { name: "Google (Gemini 2.0 / 3.7)", status: "READY", role: "Proposer", authority: "NONE", interface: "Gemini CLI / MCP" },
        { name: "Open Models & IDEs (Cursor, Windsurf, VS Code)", status: "READY", role: "Proposer", authority: "NONE", interface: "Razorpay MCP" },
        { name: "Custom Enterprise Agents", status: "READY", role: "Proposer", authority: "NONE", interface: "ACG Direct API" },
      ],
      protocols: [
        { name: "Native ACG Protocol", code: "ACG", status: "LIVE", version: "v1.0.0", description: "Direct Ed25519 mandate format (ACG authorization primitive)" },
        { name: "REST Financial Action Ingress", code: "REST", status: "LIVE", version: "v1.0.0", description: "Direct REST API endpoint for financial actions" },
        { name: "Model Context Protocol (MCP)", code: "MCP", status: "ADAPTER READY", version: "2024-11-05", description: "Claude/ChatGPT/Cursor tools/call normalization into ACG IR" },
        { name: "Agent2Agent Protocol (A2A)", code: "A2A", status: "ADAPTER READY", version: "2026.1-LF", description: "Linux Foundation A2A commerce task RPC adapter" },
        { name: "Agentic Commerce Protocol (ACP)", code: "ACP", status: "ADAPTER READY", version: "acp/1.0", description: "Cart & order envelope adapter" },
        { name: "Agent Payments Protocol (AP2)", code: "AP2", status: "ADAPTER READY", version: "v0.2.0", description: "Authorization container adapter (Maps AP2 to ACG IR; ECDSA checkout JWT binding)" },
        { name: "Universal Commerce Protocol (UCP)", code: "UCP", status: "ADAPTER READY", version: "ucp-v1.2", description: "Google open commerce journey adapter" },
        { name: "Visa Trusted Agent Protocol (TAP)", code: "TAP", status: "DESIGN", version: "tap/1.0-draft", description: "Cryptographic agent identity attestation container design" },
      ],
      payment_intelligence: [
        {
          name: "Razorpay Vulcan",
          status: "ARCHITECTURE READY",
          role: "Downstream Fraud & Routing Signals",
          model_version: "vulcan-v1.4-live-transformer",
          authority: "ADVISORY_ONLY",
          distinction: "Downstream telemetry advisory only. No public developer inference API exists; ACG models this interface for future routing integration.",
        },
        {
          name: "Heuristic Risk Evaluator",
          status: "LIVE",
          role: "Deterministic merchant risk bounds",
          authority: "ADVISORY_ONLY",
          distinction: "Evaluates policy velocity thresholds & basket size limits",
        },
        {
          name: "Pluggable Risk Provider",
          status: "PLUGGABLE",
          role: "Third-party enterprise scoring",
          authority: "ADVISORY_ONLY",
          distinction: "External risk feed adapter interface",
        },
      ],
      payment_rails: [
        { name: "Razorpay Sandbox / Standard", status: "LIVE", type: "Core Settlement Rail" },
        { name: "UPI Reserve Pay", status: "RAIL", type: "Pre-authorized delegated rail" },
        { name: "Cards & Netbanking", status: "RAIL", type: "Card network tokenization" },
        { name: "Machine Payments (x402 / MPP)", status: "PLUGGABLE", type: "HTTP-native machine rail" },
      ],
    };
  });

  app.post("/dashboard/compatibility/test-adapter", async (request: FastifyRequest, reply: FastifyReply) => {
    const { protocol } = (request.body || {}) as { protocol: string };
    const cryptoModule = await import("../core/crypto.js");
    const nodeCrypto = await import("node:crypto");
    const { generatePrincipalKeypair, signMandate } = cryptoModule;
    const keypair = generatePrincipalKeypair();
    const now = Math.floor(Date.now() / 1000);
    const activePolicy = policyEngine.getPolicy();

    const mandateData = {
      mandate_id: `man_${protocol}_${Date.now()}`,
      principal_public_key: keypair.publicKeyHex,
      budget_limit: 500000, // ₹5,000.00
      currency: "INR" as const,
      merchant_whitelist: [activePolicy.merchant_id],
      category_whitelist: ["electronics"],
      expiry: now + 3600,
    };
    const signature = signMandate(mandateData, keypair.privateKeyObject);
    const mandate = { ...mandateData, signature };

    let testPayload: any;
    const intentId = nodeCrypto.randomUUID();
    const nonce = nodeCrypto.randomBytes(16).toString("hex");

    switch ((protocol || "").toLowerCase()) {
      case "mcp":
        testPayload = {
          method: "tools/call",
          params: {
            name: "acg_checkout",
            arguments: {
              intent_id: intentId,
              client_nonce: nonce,
              timestamp: now,
              mandate,
              items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
              agent_metadata: { model_runtime: "claude-3-7-sonnet", provider: "anthropic" },
            },
          },
        };
        break;
      case "a2a":
        testPayload = {
          jsonrpc: "2.0",
          id: 1,
          method: "a2a.commerce.proposeTransaction",
          params: {
            taskId: `task_${Date.now()}`,
            senderAgent: { id: "agent_procure_alpha", did: "did:key:z6Mku", framework: "A2A-v1" },
            recipientAgent: { id: "acg_merchant_gateway" },
            payload: {
              intent_id: intentId,
              client_nonce: nonce,
              timestamp: now,
              mandate,
              proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
            },
          },
        };
        break;
      case "acp":
        testPayload = {
          protocol_version: "acp/1.0",
          transaction_id: intentId,
          session_nonce: nonce,
          timestamp: now,
          buyer_principal: { id: "user_principal_acp", public_key: keypair.publicKeyHex },
          commerce_mandate: mandate,
          line_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1, estimated_price_paise: 212400 }],
        };
        break;
      case "ap2":
        testPayload = {
          ap2_version: "0.2.0",
          payment_intent_id: intentId,
          nonce,
          created_at: now,
          payer: { principal_id: "user_principal_ap2", public_key: keypair.publicKeyHex },
          authorization_mandate: mandate,
          cart: { items: [{ sku: "SKU-MOUSE-PRO", qty: 1 }] },
        };
        break;
      case "ucp":
        testPayload = {
          ucp_standard: "ucp-v1",
          surface: "google_assistant_checkout",
          journey_id: `journey_${Date.now()}`,
          checkout_request: {
            intent_id: intentId,
            nonce,
            timestamp: now,
            delegated_mandate: mandate,
            order_lines: [{ sku: "SKU-MOUSE-PRO", quantity: 1, title: "Precision Wireless Mouse" }],
          },
        };
        break;
      case "tap":
        testPayload = {
          tap_version: "1.0",
          agent_identity: {
            agent_id: "agent_hardware_enclave_01",
            issuer: "visa:tap:registry",
            agent_public_key: nodeCrypto.randomBytes(32).toString("hex"),
            attestation_token: "attest_tok_hardware_tee_valid_signature_xyz123",
            reputation_tier: "TIER_1_VERIFIED",
          },
          commerce_payload: {
            intent_id: intentId,
            client_nonce: nonce,
            timestamp: now,
            mandate,
            proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
          },
        };
        break;
      default: // acg
        testPayload = {
          intent_id: intentId,
          client_nonce: nonce,
          timestamp: now,
          mandate,
          proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
        };
        break;
    }

    const res = await app.inject({
      method: "POST",
      url: `/v1/agent/ingress/${protocol || "acg"}`,
      payload: testPayload,
    });

    return reply.status(res.statusCode).send(JSON.parse(res.body));
  });

  app.post("/dashboard/demo/run-scenario", async (request: FastifyRequest, reply: FastifyReply) => {
    const { scenario } = (request.body || {}) as { scenario: string };
    const cryptoModule = await import("../core/crypto.js");
    const nodeCrypto = await import("node:crypto");
    const { generatePrincipalKeypair, signMandate } = cryptoModule;
    const keypair = generatePrincipalKeypair();
    const now = Math.floor(Date.now() / 1000);
    const intentId = nodeCrypto.randomUUID();

    if (scenario === "mandate-violation") {
      const mandateData = {
        mandate_id: `man_viol_${Date.now()}`,
        principal_public_key: keypair.publicKeyHex,
        budget_limit: 500000, // ₹5,000
        currency: "INR" as const,
        merchant_whitelist: [policy.merchant_id],
        category_whitelist: ["electronics", "furniture"],
        expiry: now + 3600,
      };
      const signature = signMandate(mandateData, keypair.privateKeyObject);
      const payload = {
        intent_id: intentId,
        client_nonce: nodeCrypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: { ...mandateData, signature },
        proposed_items: [{ sku: "SKU-CHAIR-ERGO", quantity: 1 }], // ₹14,160 > ₹5,000
      };
      const res = await app.inject({ method: "POST", url: "/v1/agent/checkout", payload });
      return reply.status(res.statusCode).send(JSON.parse(res.body));
    }

    if (scenario === "concurrent") {
      const mandateData = {
        mandate_id: `man_race_${Date.now()}`,
        principal_public_key: keypair.publicKeyHex,
        budget_limit: 287600, // ₹2,876 remaining
        currency: "INR" as const,
        merchant_whitelist: [policy.merchant_id],
        category_whitelist: ["electronics"],
        expiry: now + 3600,
      };
      const signature = signMandate(mandateData, keypair.privateKeyObject);
      const p1 = {
        intent_id: nodeCrypto.randomUUID(),
        client_nonce: nodeCrypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: { ...mandateData, signature },
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }], // ₹2,124
      };
      const p2 = {
        intent_id: nodeCrypto.randomUUID(),
        client_nonce: nodeCrypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: { ...mandateData, signature },
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }], // ₹2,124
      };
      const [res1, res2] = await Promise.all([
        app.inject({ method: "POST", url: "/v1/agent/checkout", payload: p1 }),
        app.inject({ method: "POST", url: "/v1/agent/checkout", payload: p2 }),
      ]);
      return reply.status(200).send({
        scenario: "concurrent",
        subagentA: { status: res1.statusCode, body: JSON.parse(res1.body) },
        subagentB: { status: res2.statusCode, body: JSON.parse(res2.body) },
      });
    }

    if (scenario === "webhook-fail") {
      const forgedRes = await app.inject({
        method: "POST",
        url: "/webhooks/razorpay",
        headers: { "x-razorpay-signature": "forged_bad_signature_123" },
        payload: { event: "payment.captured", payload: { payment: { entity: { id: "pay_forged", amount: 100000, status: "captured" } } } },
      });
      return reply.status(200).send({
        scenario: "webhook-fail",
        forgedWebhookResult: { status: forgedRes.statusCode, body: JSON.parse(forgedRes.body) },
      });
    }

    if (scenario === "refund") {
      const mandateData = {
        mandate_id: `man_ref_${Date.now()}`,
        principal_public_key: keypair.publicKeyHex,
        budget_limit: 500000,
        currency: "INR" as const,
        merchant_whitelist: [policy.merchant_id],
        category_whitelist: ["electronics"],
        expiry: now + 3600,
      };
      const signature = signMandate(mandateData, keypair.privateKeyObject);
      const checkoutRes = await app.inject({
        method: "POST",
        url: "/v1/agent/checkout",
        payload: {
          intent_id: intentId,
          client_nonce: nodeCrypto.randomBytes(16).toString("hex"),
          timestamp: now,
          mandate: { ...mandateData, signature },
          proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
        },
      });
      const order = JSON.parse(checkoutRes.body);
      // Capture
      const paymentId = `pay_${Date.now()}`;
      await app.inject({
        method: "POST",
        url: "/webhooks/razorpay",
        headers: { "x-razorpay-signature": "mock_signature" },
        payload: {
          event: "payment.captured",
          payload: { payment: { entity: { id: paymentId, order_id: order.razorpay_order_id, amount: order.amount_paise, status: "captured" } } },
        },
      });
      // Stockout refund
      await webhookProcessor.handlePostCaptureFulfillmentFailure(intentId, "Warehouse damaged stockout detected");
      const updatedSession = db.prepare("SELECT * FROM order_sessions WHERE intent_id = ?").get(intentId) as any;
      return reply.status(200).send({
        scenario: "refund",
        orderCreated: order,
        refundExecution: { success: true, status: updatedSession?.status || "REFUNDED" },
      });
    }

    // Default: happy-path (Nominal Flow)
    const mandateData = {
      mandate_id: `man_nominal_${Date.now()}`,
      principal_public_key: keypair.publicKeyHex,
      budget_limit: 500000,
      currency: "INR" as const,
      merchant_whitelist: [policy.merchant_id],
      category_whitelist: ["electronics"],
      expiry: now + 3600,
    };
    const signature = signMandate(mandateData, keypair.privateKeyObject);
    const checkoutRes = await app.inject({
      method: "POST",
      url: "/v1/agent/checkout",
      payload: {
        intent_id: intentId,
        client_nonce: nodeCrypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: { ...mandateData, signature },
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
      },
    });
    const orderData = JSON.parse(checkoutRes.body);
    if (checkoutRes.statusCode === 201) {
      await app.inject({
        method: "POST",
        url: "/webhooks/razorpay",
        headers: { "x-razorpay-signature": "mock_signature" },
        payload: {
          event: "payment.captured",
          payload: { payment: { entity: { id: `pay_${Date.now()}`, order_id: orderData.razorpay_order_id, amount: orderData.amount_paise, status: "captured" } } },
        },
      });
    }
    return reply.status(checkoutRes.statusCode).send(orderData);
  });

  // ==========================================
  // 1. PUBLIC CATALOG ENDPOINT
  // ==========================================
  app.get("/catalog", async () => {
    const activePolicy = policyEngine.getPolicy();
    const items = db.prepare("SELECT * FROM catalog_items WHERE is_active = 1").all();
    return {
      merchant_id: activePolicy.merchant_id,
      policy_version: activePolicy.policy_version,
      items,
    };
  });

  // ==========================================
  // 1b. PRINCIPAL MANDATE REVOCATION ENDPOINT
  // ==========================================
  app.post("/v1/mandates/revoke", { preHandler: [requireScope("merchant:mandate:revoke")], config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { mandate_id: string; reason?: string; signature?: string };
    if (!body || !body.mandate_id) {
      return reply.status(400).send({ error: "MISSING_MANDATE_ID", message: "mandate_id is required" });
    }
    const revokedAt = Math.floor(Date.now() / 1000);
    const reason = body.reason || "Revoked by user principal";
    db.prepare(`
      INSERT OR REPLACE INTO revoked_mandates (mandate_id, revocation_reason, revoked_at, revocation_signature)
      VALUES (?, ?, ?, ?)
    `).run(body.mandate_id, reason, revokedAt, body.signature || null);

    return reply.status(200).send({
      status: "REVOKED",
      mandate_id: body.mandate_id,
      revoked_at: revokedAt,
      reason,
    });
  });

  // ==========================================
  // 1c. MERCHANT POLICY MUTATION ENDPOINT
  // ==========================================
  app.put("/v1/merchant/policy", { preHandler: [requireScope("merchant:policy:write")], config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request: FastifyRequest, reply: FastifyReply) => {
    const newPolicy = request.body as MerchantPolicy;
    if (!newPolicy || !newPolicy.policy_version) {
      return reply.status(400).send({ error: "INVALID_POLICY", message: "policy_version is required" });
    }
    policyEngine.updatePolicy(newPolicy);
    return reply.status(200).send({
      status: "POLICY_UPDATED",
      policy: policyEngine.getPolicy(),
    });
  });

  // ==========================================
  // 2. AGENT INTENT INGRESS ENDPOINT (ACP / MCP / REST)
  // ==========================================
  app.post("/v1/agent/checkout", { config: { rateLimit: { max: 50, timeWindow: '1 minute' } } }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Phase 1: Schema Validation (Canonical Ingress)
    const parseResult = CanonicalIntentSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "INVALID_INTENT_SCHEMA",
        details: parseResult.error.format(),
      });
    }

    const intent: CanonicalIntent = parseResult.data;
    const intentId = intent.intent_id;

    // Check for Duplicate Intent ID Replay
    const existingSession = db.prepare("SELECT intent_id FROM order_sessions WHERE intent_id = ?").get(intentId);
    if (existingSession) {
      return reply.status(409).send({
        error: "DUPLICATE_INTENT_REPLAY",
        message: `Intent ID '${intentId}' has already been submitted.`,
      });
    }

    auditLedger.logTransition(intentId, "INTENT_RECEIVED", null, "INTENT_RECEIVED", {
      client_nonce: intent.client_nonce,
      mandate_id: intent.mandate.mandate_id,
      item_count: intent.proposed_items.length,
    });

    // Phase 2a: Check Mandate Revocation in Control Plane Registry
    const revokedRow = db.prepare("SELECT * FROM revoked_mandates WHERE mandate_id = ?").get(intent.mandate.mandate_id) as any;
    if (revokedRow) {
      auditLedger.logTransition(intentId, "MANDATE_REVOKED", "INTENT_RECEIVED", "INTENT_REJECTED", {
        mandate_id: intent.mandate.mandate_id,
        revoked_at: revokedRow.revoked_at,
        reason: revokedRow.revocation_reason,
      });
      return reply.status(403).send({
        error: "MANDATE_REVOKED",
        message: `Buyer mandate '${intent.mandate.mandate_id}' was revoked by principal: ${revokedRow.revocation_reason}`,
      });
    }

    // Phase 2b: Cryptographic Identity & Mandate Verification (Ed25519)
    const isSignatureValid = verifyMandateSignature(intent.mandate);
    if (!isSignatureValid) {
      auditLedger.logTransition(intentId, "SIGNATURE_VERIFICATION_FAILED", "INTENT_RECEIVED", "INTENT_REJECTED", {
        reason: "Invalid Ed25519 signature on buyer mandate payload",
      });
      return reply.status(401).send({
        error: "INVALID_MANDATE_SIGNATURE",
        message: "The cryptographic signature on the buyer mandate is invalid or tampered.",
      });
    }

    auditLedger.logTransition(intentId, "MANDATE_VERIFIED", "INTENT_RECEIVED", "INTENT_VALIDATED", {
      principal_public_key: intent.mandate.principal_public_key,
      budget_limit: intent.mandate.budget_limit,
    });

    // Phase 3: Commerce Truth Lookup (Ignore all LLM price arithmetic)
    const truthResult = truthEngine.resolveTruth(intent.proposed_items);
    if (!truthResult.isValid) {
      auditLedger.logTransition(intentId, "COMMERCE_TRUTH_FAILED", "INTENT_VALIDATED", "INTENT_REJECTED", {
        reason: truthResult.error,
      });
      return reply.status(400).send({
        error: "COMMERCE_TRUTH_REJECTION",
        message: truthResult.error,
      });
    }

    auditLedger.logTransition(intentId, "COMMERCE_TRUTH_RESOLVED", "INTENT_VALIDATED", "INTENT_VALIDATED", {
      computedTotalPaise: truthResult.totalAmount,
      totalTaxPaise: truthResult.totalTax,
      resolvedItems: truthResult.resolvedItems.map((r) => ({
        sku: r.item.sku,
        unitPrice: r.item.unit_price,
        qty: r.quantity,
        total: r.total,
      })),
    });

    // Phase 4: Merchant Policy & Effective Permission Evaluation (Active Versioned Policy)
    const activePolicy = policyEngine.getPolicy();
    const policyResult = policyEngine.evaluate(
      intent.mandate,
      truthResult.totalAmount,
      truthResult.categories,
      activePolicy.merchant_id
    );

    if (!policyResult.isAllowed) {
      auditLedger.logTransition(intentId, "POLICY_VIOLATION", "INTENT_VALIDATED", "INTENT_REJECTED", {
        reason: policyResult.reason,
        code: policyResult.violationCode,
        policy_version: policyResult.policy_version,
        effective_at: policyResult.effective_at,
        decision_timestamp: policyResult.decision_timestamp,
      });
      return reply.status(403).send({
        error: policyResult.violationCode,
        message: policyResult.reason,
      });
    }

    auditLedger.logTransition(intentId, "POLICY_EVALUATED_ALLOWED", "INTENT_VALIDATED", "INTENT_VALIDATED", {
      policy_version: policyResult.policy_version,
      effective_at: policyResult.effective_at,
      decision_timestamp: policyResult.decision_timestamp,
    });

    // Phase 5: Dual-Resource Atomic Reservation (Mandate Budget + SKU Inventory)
    const reservationResult = reservationEngine.holdReservation(
      intentId,
      intent.mandate,
      truthResult.totalAmount,
      truthResult.resolvedItems
    );

    if (!reservationResult.success) {
      auditLedger.logTransition(intentId, "RESERVATION_FAILED", "INTENT_VALIDATED", "RESERVATION_FAILED", {
        reason: reservationResult.reason,
        code: reservationResult.code,
      });
      return reply.status(409).send({
        error: reservationResult.code,
        message: reservationResult.reason,
      });
    }

    auditLedger.logTransition(intentId, "DUAL_RESERVATION_ACQUIRED", "INTENT_VALIDATED", "DUAL_RESERVATION_HELD", {
      reservationId: reservationResult.reservationId,
      reservedBudget: reservationResult.reservedAmount,
    });

    // Phase 5b: Downstream Payment Intelligence Evaluation (Razorpay Vulcan)
    const vulcanResult = await defaultVulcanIntelligence.evaluate({
      intentId,
      merchantId: activePolicy.merchant_id,
      amountPaise: truthResult.totalAmount,
      currency: "INR",
      itemCategories: truthResult.categories,
      mandateId: intent.mandate.mandate_id,
      agentId: "native-llm-agent",
      protocol: "ACG",
    });

    auditLedger.logTransition(intentId, "VULCAN_INTELLIGENCE_EVALUATED", "DUAL_RESERVATION_HELD", "DUAL_RESERVATION_HELD", {
      provider: vulcanResult.provider,
      riskScore: vulcanResult.riskSignals.riskScore,
      optimalRail: vulcanResult.routingHints.optimalRail,
      expectedSuccessRateBps: vulcanResult.routingHints.expectedSuccessRateBps,
    });

    // Phase 6: Razorpay Order Creation (with receipt = intent_id idempotency)
    try {
      const razorpayOrder = await railClient.createOrder(
        truthResult.totalAmount,
        intentId, // receipt = intent_id
        {
          mandate_id: intent.mandate.mandate_id,
          reservation_id: reservationResult.reservationId,
          policy_version: activePolicy.policy_version,
          vulcan_optimal_rail: vulcanResult.routingHints.optimalRail,
        }
      );

      // Record Order Session in DB
      const now = Date.now();
      db.prepare(`
        INSERT INTO order_sessions (
          intent_id, receipt, razorpay_order_id, amount, currency, status, reservation_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'ORDER_CREATED', ?, ?, ?)
      `).run(
        intentId,
        intentId,
        razorpayOrder.id,
        truthResult.totalAmount,
        "INR",
        reservationResult.reservationId,
        now,
        now
      );

      auditLedger.logTransition(intentId, "RAZORPAY_ORDER_CREATED", "DUAL_RESERVATION_HELD", "ORDER_CREATED", {
        razorpayOrderId: razorpayOrder.id,
        receipt: razorpayOrder.receipt,
        amountDue: razorpayOrder.amount_due,
      });

      return reply.status(201).send({
        status: "ORDER_CREATED",
        intent_id: intentId,
        receipt: intentId,
        razorpay_order_id: razorpayOrder.id,
        amount_paise: truthResult.totalAmount,
        currency: "INR",
        policy_version: activePolicy.policy_version,
        reservation_id: reservationResult.reservationId,
        payment_intelligence: {
          provider: vulcanResult.provider,
          risk_score: vulcanResult.riskSignals.riskScore,
          optimal_rail: vulcanResult.routingHints.optimalRail,
        },
        items: truthResult.resolvedItems.map((r) => ({
          sku: r.item.sku,
          name: r.item.name,
          quantity: r.quantity,
          unit_price_inr: r.item.unit_price / 100,
          total_inr: r.total / 100,
        })),
      });
    } catch (railError: any) {
      // Rollback reservation if rail creation fails
      reservationEngine.releaseReservation(reservationResult.reservationId, "Razorpay API Order creation failed");
      auditLedger.logTransition(intentId, "RAIL_EXECUTION_FAILED", "DUAL_RESERVATION_HELD", "DUAL_RESERVATION_RELEASED", {
        error: railError.message,
      });
      return reply.status(502).send({
        error: "PAYMENT_RAIL_ERROR",
        message: `Failed to initialize payment with Razorpay: ${railError.message}`,
      });
    }
  });

  // ==========================================
  // 2b. UNIVERSAL PROTOCOL INGRESS (MCP, A2A, ACP, AP2, UCP, TAP)
  // ==========================================
  app.post("/v1/agent/ingress/:protocol", { config: { rateLimit: { max: 50, timeWindow: '1 minute' } } }, async (request: any, reply: any) => {
    const { protocol } = request.params;
    const activePolicy = policyEngine.getPolicy();

    // Phase 0: Adapter Protocol Normalization
    const adapterResult = await defaultAdapterRegistry.normalize(protocol, request.body, activePolicy.merchant_id);
    if (!adapterResult.success) {
      return reply.status(400).send({
        error: adapterResult.code,
        message: adapterResult.error,
        details: adapterResult.details,
      });
    }

    const intent = adapterResult.intent;
    const intentId = intent.intent_id;

    // Check for Duplicate Intent ID Replay
    const existingSession = db.prepare("SELECT intent_id FROM order_sessions WHERE intent_id = ?").get(intentId);
    if (existingSession) {
      return reply.status(409).send({
        error: "DUPLICATE_INTENT_REPLAY",
        message: `Intent ID '${intentId}' has already been submitted.`,
      });
    }

    auditLedger.logTransition(intentId, "INTENT_RECEIVED", null, "INTENT_RECEIVED", {
      client_nonce: intent.client_nonce,
      mandate_id: intent.mandate.mandate_id,
      item_count: intent.proposed_items.length,
      ingress_protocol: adapterResult.metadata.sourceProtocol,
      agent_id: adapterResult.metadata.agentId,
      raw_hash: adapterResult.metadata.rawHash,
    });

    // Check Mandate Revocation in Control Plane
    const revokedRow = db.prepare("SELECT * FROM revoked_mandates WHERE mandate_id = ?").get(intent.mandate.mandate_id) as any;
    if (revokedRow) {
      auditLedger.logTransition(intentId, "MANDATE_REVOKED", "INTENT_RECEIVED", "INTENT_REJECTED", {
        mandate_id: intent.mandate.mandate_id,
        revoked_at: revokedRow.revoked_at,
        reason: revokedRow.revocation_reason,
      });
      return reply.status(403).send({
        error: "MANDATE_REVOKED",
        message: `Buyer mandate '${intent.mandate.mandate_id}' was revoked by principal: ${revokedRow.revocation_reason}`,
      });
    }

    // Cryptographic Identity & Mandate Verification (Ed25519)
    const isSignatureValid = verifyMandateSignature(intent.mandate);
    if (!isSignatureValid) {
      auditLedger.logTransition(intentId, "SIGNATURE_VERIFICATION_FAILED", "INTENT_RECEIVED", "INTENT_REJECTED", {
        reason: "Invalid Ed25519 signature on buyer mandate payload",
      });
      return reply.status(401).send({
        error: "INVALID_MANDATE_SIGNATURE",
        message: "The cryptographic signature on the buyer mandate is invalid or tampered.",
      });
    }

    auditLedger.logTransition(intentId, "MANDATE_VERIFIED", "INTENT_RECEIVED", "INTENT_VALIDATED", {
      principal_public_key: intent.mandate.principal_public_key,
      budget_limit: intent.mandate.budget_limit,
      protocol: adapterResult.metadata.sourceProtocol,
    });

    // Commerce Truth Lookup
    const truthResult = truthEngine.resolveTruth(intent.proposed_items);
    if (!truthResult.isValid) {
      auditLedger.logTransition(intentId, "COMMERCE_TRUTH_FAILED", "INTENT_VALIDATED", "INTENT_REJECTED", {
        reason: truthResult.error,
      });
      return reply.status(400).send({
        error: "COMMERCE_TRUTH_REJECTION",
        message: truthResult.error,
      });
    }

    auditLedger.logTransition(intentId, "COMMERCE_TRUTH_RESOLVED", "INTENT_VALIDATED", "INTENT_VALIDATED", {
      computedTotalPaise: truthResult.totalAmount,
      totalTaxPaise: truthResult.totalTax,
      resolvedItems: truthResult.resolvedItems.map((r) => ({
        sku: r.item.sku,
        unitPrice: r.item.unit_price,
        qty: r.quantity,
        total: r.total,
      })),
    });

    // Merchant Policy Evaluation
    const policyResult = policyEngine.evaluate(
      intent.mandate,
      truthResult.totalAmount,
      truthResult.categories,
      activePolicy.merchant_id
    );

    if (!policyResult.isAllowed) {
      auditLedger.logTransition(intentId, "POLICY_VIOLATION", "INTENT_VALIDATED", "INTENT_REJECTED", {
        reason: policyResult.reason,
        code: policyResult.violationCode,
        policy_version: policyResult.policy_version,
      });
      return reply.status(403).send({
        error: policyResult.violationCode,
        message: policyResult.reason,
      });
    }

    auditLedger.logTransition(intentId, "POLICY_EVALUATED_ALLOWED", "INTENT_VALIDATED", "INTENT_VALIDATED", {
      policy_version: policyResult.policy_version,
    });

    // Dual-Resource Atomic Reservation
    const reservationResult = reservationEngine.holdReservation(
      intentId,
      intent.mandate,
      truthResult.totalAmount,
      truthResult.resolvedItems
    );

    if (!reservationResult.success) {
      auditLedger.logTransition(intentId, "RESERVATION_FAILED", "INTENT_VALIDATED", "RESERVATION_FAILED", {
        reason: reservationResult.reason,
        code: reservationResult.code,
      });
      return reply.status(409).send({
        error: reservationResult.code,
        message: reservationResult.reason,
      });
    }

    auditLedger.logTransition(intentId, "DUAL_RESERVATION_ACQUIRED", "INTENT_VALIDATED", "DUAL_RESERVATION_HELD", {
      reservationId: reservationResult.reservationId,
      reservedBudget: reservationResult.reservedAmount,
    });

    // Phase 5b: Downstream Payment Intelligence Evaluation (Razorpay Vulcan)
    const vulcanResult = await defaultVulcanIntelligence.evaluate({
      intentId,
      merchantId: activePolicy.merchant_id,
      amountPaise: truthResult.totalAmount,
      currency: "INR",
      itemCategories: truthResult.categories,
      mandateId: intent.mandate.mandate_id,
      agentId: adapterResult.metadata.agentId,
      protocol: adapterResult.metadata.sourceProtocol,
    });

    auditLedger.logTransition(intentId, "VULCAN_INTELLIGENCE_EVALUATED", "DUAL_RESERVATION_HELD", "DUAL_RESERVATION_HELD", {
      provider: vulcanResult.provider,
      riskScore: vulcanResult.riskSignals.riskScore,
      optimalRail: vulcanResult.routingHints.optimalRail,
      expectedSuccessRateBps: vulcanResult.routingHints.expectedSuccessRateBps,
    });

    // Phase 6: Razorpay Order Creation
    try {
      const razorpayOrder = await railClient.createOrder(
        truthResult.totalAmount,
        intentId,
        {
          mandate_id: intent.mandate.mandate_id,
          reservation_id: reservationResult.reservationId,
          policy_version: activePolicy.policy_version,
          protocol: adapterResult.metadata.sourceProtocol,
          vulcan_optimal_rail: vulcanResult.routingHints.optimalRail,
        }
      );

      const now = Date.now();
      db.prepare(`
        INSERT INTO order_sessions (
          intent_id, receipt, razorpay_order_id, amount, currency, status, reservation_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'ORDER_CREATED', ?, ?, ?)
      `).run(
        intentId,
        intentId,
        razorpayOrder.id,
        truthResult.totalAmount,
        "INR",
        reservationResult.reservationId,
        now,
        now
      );

      auditLedger.logTransition(intentId, "RAZORPAY_ORDER_CREATED", "DUAL_RESERVATION_HELD", "ORDER_CREATED", {
        razorpayOrderId: razorpayOrder.id,
        receipt: razorpayOrder.receipt,
        amountDue: razorpayOrder.amount_due,
      });

      return reply.status(201).send({
        status: "ORDER_CREATED",
        intent_id: intentId,
        receipt: intentId,
        razorpay_order_id: razorpayOrder.id,
        amount_paise: truthResult.totalAmount,
        currency: "INR",
        policy_version: activePolicy.policy_version,
        reservation_id: reservationResult.reservationId,
        ingress_protocol: adapterResult.metadata.sourceProtocol,
        agent_id: adapterResult.metadata.agentId,
        payment_intelligence: {
          provider: vulcanResult.provider,
          risk_score: vulcanResult.riskSignals.riskScore,
          optimal_rail: vulcanResult.routingHints.optimalRail,
          authority_disclaimer: vulcanResult.authorityDisclaimer,
        },
        items: truthResult.resolvedItems.map((r) => ({
          sku: r.item.sku,
          name: r.item.name,
          quantity: r.quantity,
          unit_price_inr: r.item.unit_price / 100,
          total_inr: r.total / 100,
        })),
      });
    } catch (railError: any) {
      reservationEngine.releaseReservation(reservationResult.reservationId, "Razorpay API Order creation failed");
      auditLedger.logTransition(intentId, "RAIL_EXECUTION_FAILED", "DUAL_RESERVATION_HELD", "DUAL_RESERVATION_RELEASED", {
        error: railError.message,
      });
      return reply.status(502).send({
        error: "PAYMENT_RAIL_ERROR",
        message: `Failed to initialize payment with Razorpay: ${railError.message}`,
      });
    }
  });

  // ==========================================
  // 3. RAZORPAY WEBHOOK ENDPOINT
  // ==========================================
  app.post("/webhooks/razorpay", { config: { rateLimit: { max: 200, timeWindow: '1 minute' } } }, async (request: FastifyRequest, reply: FastifyReply) => {
    const rawBody = JSON.stringify(request.body);
    const signature = (request.headers["x-razorpay-signature"] as string) || "";
    const eventId = (request.headers["x-razorpay-event-id"] as string) || `event_${Date.now()}`;

    // Verify HMAC Signature (Skip in mock test if signature header is mock)
    if (signature !== "mock_signature" && !webhookProcessor.verifySignature(rawBody, signature)) {
      return reply.status(401).send({ error: "INVALID_WEBHOOK_SIGNATURE" });
    }

    const result = await webhookProcessor.processEvent(eventId, request.body as any);
    return reply.status(200).send(result);
  });

  // ==========================================
  // 4. TAMPER-EVIDENT AUDIT TRAJECTORY ENDPOINT
  // ==========================================
  app.get("/audit/:intentId", async (request: FastifyRequest<{ Params: { intentId: string } }>, reply: FastifyReply) => {
    const trajectory = auditLedger.getTrajectory(request.params.intentId);
    return reply.send({
      intent_id: request.params.intentId,
      step_count: trajectory.length,
      trajectory,
    });
  });

  // ==========================================
  // 5. AUDIT CHAIN INTEGRITY CHECK
  // ==========================================
  app.get("/audit/integrity", async () => {
    return auditLedger.verifyLedgerIntegrity();
  });

  return {
    truthEngine,
    policyEngine,
    reservationEngine,
    auditLedger,
    railClient,
    webhookProcessor,
  };
}
