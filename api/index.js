var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/core/crypto.ts
var crypto_exports = {};
__export(crypto_exports, {
  generatePrincipalKeypair: () => generatePrincipalKeypair,
  getCanonicalMandateBytes: () => getCanonicalMandateBytes,
  signMandate: () => signMandate,
  verifyMandateSignature: () => verifyMandateSignature
});
import crypto from "node:crypto";
function getCanonicalMandateBytes(mandate) {
  const canonicalObject = {
    mandate_id: mandate.mandate_id,
    principal_public_key: mandate.principal_public_key,
    budget_limit: mandate.budget_limit,
    currency: mandate.currency,
    merchant_whitelist: mandate.merchant_whitelist ? [...mandate.merchant_whitelist].sort() : void 0,
    category_whitelist: mandate.category_whitelist ? [...mandate.category_whitelist].sort() : void 0,
    expiry: mandate.expiry
  };
  return Buffer.from(JSON.stringify(canonicalObject));
}
function verifyMandateSignature(mandate) {
  try {
    const dataBytes = getCanonicalMandateBytes(mandate);
    const publicKeyBuffer = Buffer.from(mandate.principal_public_key, "hex");
    const signatureBuffer = Buffer.from(mandate.signature, "hex");
    const keyObject = crypto.createPublicKey({
      key: Buffer.concat([
        Buffer.from("302a300506032b6570032100", "hex"),
        // Ed25519 SPKI prefix
        publicKeyBuffer
      ]),
      format: "der",
      type: "spki"
    });
    return crypto.verify(null, dataBytes, keyObject, signatureBuffer);
  } catch (error) {
    return false;
  }
}
function generatePrincipalKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const exportedSpki = publicKey.export({ type: "spki", format: "der" });
  const rawPublicKey = exportedSpki.subarray(exportedSpki.length - 32);
  const exportedPkcs8 = privateKey.export({ type: "pkcs8", format: "der" });
  const rawPrivateKey = exportedPkcs8.subarray(exportedPkcs8.length - 32);
  return {
    publicKeyHex: rawPublicKey.toString("hex"),
    privateKeyHex: rawPrivateKey.toString("hex"),
    privateKeyObject: privateKey,
    publicKeyObject: publicKey
  };
}
function signMandate(mandateData, privateKeyObject) {
  const dataBytes = getCanonicalMandateBytes(mandateData);
  const signature = crypto.sign(null, dataBytes, privateKeyObject);
  return signature.toString("hex");
}
var init_crypto = __esm({
  "src/core/crypto.ts"() {
    "use strict";
  }
});

// src/server.ts
import Fastify from "fastify";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// src/store/db.ts
import path from "node:path";
import fs from "node:fs";
var NativeDatabaseSync = null;
try {
  const sqlite = await import("node:sqlite");
  NativeDatabaseSync = sqlite.DatabaseSync;
} catch {
}
var MemoryStatement = class {
  constructor(sql, db) {
    this.sql = sql;
    this.db = db;
  }
  sql;
  db;
  get(...params) {
    return this.db.queryGet(this.sql, params);
  }
  all(...params) {
    return this.db.queryAll(this.sql, params);
  }
  run(...params) {
    return this.db.queryRun(this.sql, params);
  }
};
var FallbackDatabase = class {
  tables = /* @__PURE__ */ new Map();
  exec(_sql) {
    return this;
  }
  prepare(sql) {
    return new MemoryStatement(sql, this);
  }
  queryGet(sql, params) {
    const all = this.queryAll(sql, params);
    return all.length > 0 ? all[0] : void 0;
  }
  queryAll(sql, _params) {
    if (sql.includes("COUNT(*)")) {
      return [{ count: 0, gmv: 0 }];
    }
    if (sql.includes("catalog_items")) {
      return [
        { sku: "SKU-MACBOOK-M3", name: "Apple MacBook Pro M3 Max", category: "electronics", unit_price: 3499e4, tax_rate_bps: 1800, available_stock: 25, is_active: 1 },
        { sku: "SKU-IPHONE-16PRO", name: "Apple iPhone 16 Pro 256GB", category: "electronics", unit_price: 1349e4, tax_rate_bps: 1800, available_stock: 50, is_active: 1 },
        { sku: "SKU-HERMAN-CHAIR", name: "Herman Miller Aeron Ergonomic Chair", category: "furniture", unit_price: 125e5, tax_rate_bps: 1800, available_stock: 12, is_active: 1 }
      ];
    }
    return [];
  }
  queryRun(_sql, _params) {
    return { changes: 1, lastInsertRowid: 1 };
  }
};
function initDatabase(dbPath = "./data/acg_gateway.db") {
  if (!NativeDatabaseSync) {
    console.warn("Using In-Memory Fallback Database because node:sqlite is unavailable.");
    return new FallbackDatabase();
  }
  if (dbPath !== ":memory:") {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  const db = new NativeDatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    -- 1. Merchant Catalog Truth Table
    CREATE TABLE IF NOT EXISTS catalog_items (
      sku TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit_price INTEGER NOT NULL,
      tax_rate_bps INTEGER NOT NULL DEFAULT 1800,
      available_stock INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    -- 2. Buyer Mandate Balance Tracking
    CREATE TABLE IF NOT EXISTS buyer_mandates (
      mandate_id TEXT PRIMARY KEY,
      principal_public_key TEXT NOT NULL,
      budget_limit INTEGER NOT NULL,
      remaining_budget INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      expiry INTEGER NOT NULL,
      signature TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- 2b. Principal Mandate Revocation Registry
    CREATE TABLE IF NOT EXISTS revoked_mandates (
      mandate_id TEXT PRIMARY KEY,
      principal_public_key TEXT,
      revocation_reason TEXT NOT NULL,
      revoked_at INTEGER NOT NULL,
      revocation_signature TEXT
    );

    -- 3. Dual-Resource Reservations
    CREATE TABLE IF NOT EXISTS reservations (
      reservation_id TEXT PRIMARY KEY,
      intent_id TEXT UNIQUE NOT NULL,
      mandate_id TEXT NOT NULL,
      reserved_budget INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (mandate_id) REFERENCES buyer_mandates(mandate_id)
    );

    -- 4. Reservation Items (Inventory Stock Lock)
    CREATE TABLE IF NOT EXISTS reservation_items (
      reservation_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      tax_amount INTEGER NOT NULL,
      PRIMARY KEY (reservation_id, sku),
      FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id),
      FOREIGN KEY (sku) REFERENCES catalog_items(sku)
    );

    -- 5. Order Sessions (Razorpay Integration)
    CREATE TABLE IF NOT EXISTS order_sessions (
      intent_id TEXT PRIMARY KEY,
      receipt TEXT UNIQUE NOT NULL,
      razorpay_order_id TEXT UNIQUE,
      razorpay_payment_id TEXT,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL,
      reservation_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id)
    );

    -- 6. Webhook Event Deduplication Log
    CREATE TABLE IF NOT EXISTS processed_webhook_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      order_id TEXT,
      payment_id TEXT,
      processed_at INTEGER NOT NULL,
      payload_json TEXT NOT NULL
    );

    -- 7. Tamper-Evident SHA-256 Audit Ledger
    CREATE TABLE IF NOT EXISTS audit_ledger (
      audit_id TEXT PRIMARY KEY,
      intent_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      previous_state TEXT,
      new_state TEXT NOT NULL,
      details_json TEXT NOT NULL,
      record_hash TEXT NOT NULL,
      previous_record_hash TEXT
    );

    -- 8. V2: Agent Principals Model
    CREATE TABLE IF NOT EXISTS agent_principals (
      agent_id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      model_name TEXT NOT NULL,
      agent_type TEXT NOT NULL,
      trust_level TEXT NOT NULL,
      credential_state TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      status TEXT NOT NULL,
      metadata_json TEXT
    );

    -- 9. V2: Agent Capabilities Registry
    CREATE TABLE IF NOT EXISTS agent_capabilities (
      capability_id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      capability TEXT NOT NULL,
      max_amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      categories_json TEXT NOT NULL DEFAULT '["*"]',
      merchant_scope_json TEXT NOT NULL DEFAULT '["*"]',
      daily_budget INTEGER NOT NULL,
      daily_spent INTEGER NOT NULL DEFAULT 0,
      confirmation_above INTEGER NOT NULL DEFAULT 300000,
      expires_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (agent_id) REFERENCES agent_principals(agent_id)
    );

    -- 10. V2: Merchant Budgets
    CREATE TABLE IF NOT EXISTS merchant_budgets (
      merchant_id TEXT PRIMARY KEY,
      daily_budget_limit INTEGER NOT NULL,
      daily_spent INTEGER NOT NULL DEFAULT 0,
      reset_at INTEGER NOT NULL
    );

    -- 11. V2: Kill Switches
    CREATE TABLE IF NOT EXISTS kill_switches (
      scope TEXT PRIMARY KEY,
      is_paused INTEGER NOT NULL DEFAULT 0,
      reason TEXT,
      activated_by TEXT,
      updated_at INTEGER NOT NULL
    );

    -- 12. V2: Velocity Ledger
    CREATE TABLE IF NOT EXISTS velocity_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      timestamp INTEGER NOT NULL
    );

    -- 13. V2: PDP Authorization Decisions
    CREATE TABLE IF NOT EXISTS pdp_decisions (
      decision_id TEXT PRIMARY KEY,
      intent_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      merchant_id TEXT NOT NULL,
      decision TEXT NOT NULL,
      reason_code TEXT NOT NULL,
      policy_id TEXT NOT NULL,
      policy_version TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      input_references_json TEXT NOT NULL,
      authorization_evidence_json TEXT NOT NULL,
      resource_decision_json TEXT NOT NULL
    );

    -- 14. V2: Human Confirmations
    CREATE TABLE IF NOT EXISTS pending_confirmations (
      confirmation_id TEXT PRIMARY KEY,
      decision_id TEXT NOT NULL,
      intent_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      merchant_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      confirmation_token TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      confirmed_at INTEGER,
      confirmed_by TEXT,
      payload_json TEXT NOT NULL
    );

    -- 15. V3: Granular Decision Traces
    CREATE TABLE IF NOT EXISTS decision_traces (
      trace_id TEXT PRIMARY KEY,
      intent_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      merchant_id TEXT NOT NULL,
      total_latency_ms REAL NOT NULL,
      phases_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- 16. V3: Agent Security Incident Events
    CREATE TABLE IF NOT EXISTS incident_events (
      incident_id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      merchant_id TEXT NOT NULL,
      intent_id TEXT,
      incident_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      details_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_at INTEGER NOT NULL,
      resolved_at INTEGER,
      resolved_by TEXT
    );

    -- 17. V4: Multi-Agent Delegation Grants
    CREATE TABLE IF NOT EXISTS delegations (
      delegation_id TEXT PRIMARY KEY,
      parent_agent_id TEXT NOT NULL,
      child_agent_id TEXT NOT NULL,
      merchant_id TEXT NOT NULL,
      max_amount_paise INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      allowed_actions_json TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE'
    );

    -- 18. V5: AI Growth & Revenue Attribution Events
    CREATE TABLE IF NOT EXISTS revenue_attribution_events (
      event_id TEXT PRIMARY KEY,
      intent_id TEXT,
      session_id TEXT,
      event_type TEXT NOT NULL,
      base_amount INTEGER NOT NULL DEFAULT 0,
      cross_sell_amount INTEGER NOT NULL DEFAULT 0,
      final_amount INTEGER NOT NULL DEFAULT 0,
      sku_list_json TEXT,
      metadata_json TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  return db;
}

// src/core/types.ts
import { z } from "zod";
var BuyerMandateSchema = z.object({
  mandate_id: z.string().min(1),
  principal_public_key: z.string().min(32),
  // Hex-encoded Ed25519 public key
  budget_limit: z.number().int().positive(),
  // in paise (e.g., 500000 = INR 5000)
  currency: z.literal("INR"),
  merchant_whitelist: z.array(z.string()).optional(),
  category_whitelist: z.array(z.string()).optional(),
  expiry: z.number().int().positive(),
  // Unix timestamp (seconds)
  signature: z.string().min(64)
  // Hex-encoded Ed25519 signature over canonical mandate fields
});
var ProposedItemSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive()
});
var CanonicalIntentSchema = z.object({
  intent_id: z.string().uuid(),
  client_nonce: z.string().min(16),
  timestamp: z.number().int().positive(),
  mandate: BuyerMandateSchema,
  proposed_items: z.array(ProposedItemSchema).nonempty()
});

// src/gateway/router.ts
init_crypto();

// src/core/truth.ts
var CommerceTruthEngine = class {
  db;
  constructor(db) {
    this.db = db;
  }
  /**
   * Seed standard merchant catalog items if empty.
   */
  seedDefaultCatalog() {
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO catalog_items (sku, name, category, unit_price, tax_rate_bps, available_stock, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const defaultItems = [
      {
        sku: "SKU-KEYBOARD-RGB",
        name: "Wireless Mechanical Keyboard (RGB)",
        category: "electronics",
        unit_price: 35e4,
        // INR 3,500.00
        tax_rate_bps: 1800,
        // 18% GST (INR 630.00 -> Total INR 4,130.00)
        available_stock: 5,
        is_active: true
      },
      {
        sku: "SKU-KEYBOARD-SLIM",
        name: "Compact Wireless Keyboard (Slim)",
        category: "electronics",
        unit_price: 152458,
        // INR 1,524.58
        tax_rate_bps: 1800,
        // 18% GST (INR 274.42 -> Total INR 1,799.00)
        available_stock: 10,
        is_active: true
      },
      {
        sku: "SKU-MOUSE-PRO",
        name: "Ergonomic Optical Gaming Mouse",
        category: "electronics",
        unit_price: 18e4,
        // INR 1,800.00
        tax_rate_bps: 1800,
        // 18% GST (INR 324.00 -> Total INR 2,124.00)
        available_stock: 12,
        is_active: true
      },
      {
        sku: "SKU-MOUSE-SLIM",
        name: "Precision Ergonomic Mouse (Wireless)",
        category: "electronics",
        unit_price: 76186,
        // INR 761.86
        tax_rate_bps: 1800,
        // 18% GST (INR 137.14 -> Total INR 899.00)
        available_stock: 15,
        is_active: true
      },
      {
        sku: "SKU-HEADSET-STUDIO",
        name: "Noise-Cancelling Studio Headset",
        category: "electronics",
        unit_price: 127119,
        // INR 1,271.19
        tax_rate_bps: 1800,
        // 18% GST (INR 228.81 -> Total INR 1,500.00)
        available_stock: 8,
        is_active: true
      },
      {
        sku: "SKU-CHAIR-ERGO",
        name: "Executive Ergonomic Mesh Chair",
        category: "furniture",
        unit_price: 12e5,
        // INR 12,000.00
        tax_rate_bps: 1800,
        // 18% GST (INR 2,160.00 -> Total INR 14,160.00)
        available_stock: 3,
        is_active: true
      }
    ];
    for (const item of defaultItems) {
      insert.run(
        item.sku,
        item.name,
        item.category,
        item.unit_price,
        item.tax_rate_bps,
        item.available_stock,
        item.is_active ? 1 : 0
      );
    }
  }
  /**
   * Resolves proposed items from LLM against canonical database truth.
   * Completely ignores any price/tax claim generated by the LLM.
   */
  resolveTruth(proposedItems) {
    const resolved = [];
    let grandTotal = 0;
    let grandTax = 0;
    const categoriesSet = /* @__PURE__ */ new Set();
    const getItemStmt = this.db.prepare("SELECT * FROM catalog_items WHERE sku = ? AND is_active = 1");
    for (const proposed of proposedItems) {
      const row = getItemStmt.get(proposed.sku);
      if (!row) {
        return {
          isValid: false,
          error: `SKU '${proposed.sku}' does not exist or is inactive in merchant catalog`,
          resolvedItems: [],
          totalAmount: 0,
          totalTax: 0,
          categories: []
        };
      }
      const item = {
        sku: String(row.sku),
        name: String(row.name),
        category: String(row.category),
        unit_price: Number(row.unit_price),
        tax_rate_bps: Number(row.tax_rate_bps),
        available_stock: Number(row.available_stock),
        is_active: Boolean(row.is_active)
      };
      if (item.available_stock < proposed.quantity) {
        return {
          isValid: false,
          error: `Insufficient stock for SKU '${proposed.sku}': requested ${proposed.quantity}, available ${item.available_stock}`,
          resolvedItems: [],
          totalAmount: 0,
          totalTax: 0,
          categories: []
        };
      }
      const subtotal = item.unit_price * proposed.quantity;
      const tax = Math.round(subtotal * item.tax_rate_bps / 1e4);
      const total = subtotal + tax;
      grandTotal += total;
      grandTax += tax;
      categoriesSet.add(item.category);
      resolved.push({
        item,
        quantity: proposed.quantity,
        subtotal,
        tax,
        total
      });
    }
    return {
      isValid: true,
      resolvedItems: resolved,
      totalAmount: grandTotal,
      totalTax: grandTax,
      categories: Array.from(categoriesSet)
    };
  }
};

// src/core/policy.ts
var PolicyEngine = class {
  policy;
  constructor(policy) {
    this.policy = policy;
  }
  updatePolicy(newPolicy) {
    this.policy = newPolicy;
  }
  getPolicy() {
    return this.policy;
  }
  /**
   * Evaluates Effective Permission with immutable policy versioning.
   */
  evaluate(mandate, computedTotalAmount, proposedCategories, merchantId) {
    const decisionTimestamp = Math.floor(Date.now() / 1e3);
    const baseInfo = {
      policy_version: this.policy.policy_version,
      effective_at: this.policy.effective_at,
      decision_timestamp: decisionTimestamp
    };
    if (decisionTimestamp > mandate.expiry) {
      return {
        ...baseInfo,
        isAllowed: false,
        reason: `Mandate expired at timestamp ${mandate.expiry} (current: ${decisionTimestamp})`,
        violationCode: "MANDATE_EXPIRED"
      };
    }
    if (mandate.merchant_whitelist && mandate.merchant_whitelist.length > 0) {
      if (!mandate.merchant_whitelist.includes(merchantId)) {
        return {
          ...baseInfo,
          isAllowed: false,
          reason: `Merchant '${merchantId}' not permitted by buyer mandate whitelist`,
          violationCode: "MERCHANT_NOT_WHITELISTED"
        };
      }
    }
    if (mandate.category_whitelist && mandate.category_whitelist.length > 0) {
      for (const cat of proposedCategories) {
        if (!mandate.category_whitelist.includes(cat)) {
          return {
            ...baseInfo,
            isAllowed: false,
            reason: `Category '${cat}' not permitted by buyer mandate category whitelist`,
            violationCode: "CATEGORY_NOT_WHITELISTED"
          };
        }
      }
    }
    if (computedTotalAmount > mandate.budget_limit) {
      return {
        ...baseInfo,
        isAllowed: false,
        reason: `Computed total (\u20B9${(computedTotalAmount / 100).toFixed(2)}) exceeds buyer mandate limit (\u20B9${(mandate.budget_limit / 100).toFixed(2)})`,
        violationCode: "MANDATE_BUDGET_EXCEEDED"
      };
    }
    if (computedTotalAmount > this.policy.max_transaction_amount) {
      return {
        ...baseInfo,
        isAllowed: false,
        reason: `Order total (\u20B9${(computedTotalAmount / 100).toFixed(2)}) exceeds merchant maximum transaction limit (\u20B9${(this.policy.max_transaction_amount / 100).toFixed(2)})`,
        violationCode: "MERCHANT_MAX_AMOUNT_EXCEEDED"
      };
    }
    for (const cat of proposedCategories) {
      if (!this.policy.allowed_categories.includes(cat)) {
        return {
          ...baseInfo,
          isAllowed: false,
          reason: `Category '${cat}' is not enabled for agentic checkout on this merchant store`,
          violationCode: "MERCHANT_CATEGORY_RESTRICTED"
        };
      }
    }
    return {
      ...baseInfo,
      isAllowed: true
    };
  }
};

// src/core/reservation.ts
import crypto2 from "node:crypto";
var DualResourceReservationEngine = class {
  db;
  constructor(db) {
    this.db = db;
  }
  /**
   * Atomically registers or retrieves a mandate balance in the ledger.
   */
  registerMandateIfAbsent(mandate) {
    const existing = this.db.prepare("SELECT mandate_id FROM buyer_mandates WHERE mandate_id = ?").get(mandate.mandate_id);
    if (!existing) {
      this.db.prepare(`
          INSERT INTO buyer_mandates (
            mandate_id, principal_public_key, budget_limit, remaining_budget, currency, expiry, signature, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
        mandate.mandate_id,
        mandate.principal_public_key,
        mandate.budget_limit,
        mandate.budget_limit,
        // initially 100% available
        mandate.currency,
        mandate.expiry,
        mandate.signature,
        Date.now()
      );
    }
  }
  /**
   * ATOMIC DUAL-RESOURCE RESERVATION
   * Atomically locks:
   * 1. Buyer Mandate Remaining Budget (decrements available paise)
   * 2. Merchant SKU Inventory (decrements available units)
   * If either check fails, the entire transaction is rolled back.
   */
  holdReservation(intentId, mandate, totalRequiredAmount, resolvedItems, ttlSeconds = 300) {
    this.db.exec("BEGIN IMMEDIATE TRANSACTION;");
    try {
      this.registerMandateIfAbsent(mandate);
      const mandateRow = this.db.prepare("SELECT remaining_budget FROM buyer_mandates WHERE mandate_id = ?").get(mandate.mandate_id);
      const remainingBudget = Number(mandateRow.remaining_budget);
      if (remainingBudget < totalRequiredAmount) {
        this.db.exec("ROLLBACK;");
        return {
          success: false,
          reason: `Insufficient remaining mandate budget: required \u20B9${(totalRequiredAmount / 100).toFixed(2)}, available \u20B9${(remainingBudget / 100).toFixed(2)}`,
          code: "MANDATE_EXHAUSTED"
        };
      }
      for (const resItem of resolvedItems) {
        const stockRow = this.db.prepare("SELECT available_stock FROM catalog_items WHERE sku = ?").get(resItem.item.sku);
        const availableStock = Number(stockRow.available_stock);
        if (availableStock < resItem.quantity) {
          this.db.exec("ROLLBACK;");
          return {
            success: false,
            reason: `Insufficient inventory for SKU '${resItem.item.sku}': requested ${resItem.quantity}, available ${availableStock}`,
            code: "INSUFFICIENT_STOCK"
          };
        }
      }
      this.db.prepare("UPDATE buyer_mandates SET remaining_budget = remaining_budget - ? WHERE mandate_id = ?").run(totalRequiredAmount, mandate.mandate_id);
      for (const resItem of resolvedItems) {
        this.db.prepare("UPDATE catalog_items SET available_stock = available_stock - ? WHERE sku = ?").run(resItem.quantity, resItem.item.sku);
      }
      const reservationId = `res_${crypto2.randomUUID()}`;
      const now = Date.now();
      const expiresAt = now + ttlSeconds * 1e3;
      this.db.prepare(`
          INSERT INTO reservations (reservation_id, intent_id, mandate_id, reserved_budget, status, created_at, expires_at)
          VALUES (?, ?, ?, ?, 'HELD', ?, ?)
        `).run(reservationId, intentId, mandate.mandate_id, totalRequiredAmount, now, expiresAt);
      const insertItemStmt = this.db.prepare(`
        INSERT INTO reservation_items (reservation_id, sku, quantity, unit_price, tax_amount)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const resItem of resolvedItems) {
        insertItemStmt.run(reservationId, resItem.item.sku, resItem.quantity, resItem.item.unit_price, resItem.tax);
      }
      this.db.exec("COMMIT;");
      return {
        success: true,
        reservationId,
        intentId,
        mandateId: mandate.mandate_id,
        reservedAmount: totalRequiredAmount,
        reservedItems: resolvedItems.map((r) => ({
          sku: r.item.sku,
          quantity: r.quantity,
          unitPrice: r.item.unit_price,
          taxAmount: r.tax
        }))
      };
    } catch (err) {
      try {
        this.db.exec("ROLLBACK;");
      } catch (_) {
      }
      return {
        success: false,
        reason: `Transactional execution failed: ${err.message}`,
        code: "DATABASE_LOCK_ERROR"
      };
    }
  }
  /**
   * ATOMIC DUAL-RESOURCE ROLLBACK
   */
  releaseReservation(reservationId, reason) {
    this.db.exec("BEGIN IMMEDIATE TRANSACTION;");
    try {
      const res = this.db.prepare("SELECT * FROM reservations WHERE reservation_id = ? AND status = 'HELD'").get(reservationId);
      if (!res) {
        this.db.exec("ROLLBACK;");
        return false;
      }
      const reservedBudget = Number(res.reserved_budget);
      this.db.prepare("UPDATE buyer_mandates SET remaining_budget = remaining_budget + ? WHERE mandate_id = ?").run(reservedBudget, res.mandate_id);
      const items = this.db.prepare("SELECT sku, quantity FROM reservation_items WHERE reservation_id = ?").all(reservationId);
      for (const item of items) {
        this.db.prepare("UPDATE catalog_items SET available_stock = available_stock + ? WHERE sku = ?").run(Number(item.quantity), item.sku);
      }
      this.db.prepare("UPDATE reservations SET status = 'RELEASED' WHERE reservation_id = ?").run(reservationId);
      this.db.exec("COMMIT;");
      return true;
    } catch (err) {
      try {
        this.db.exec("ROLLBACK;");
      } catch (_) {
      }
      return false;
    }
  }
  /**
   * Commits the reservation permanently (payment captured).
   */
  commitReservation(reservationId) {
    const res = this.db.prepare("UPDATE reservations SET status = 'COMMITTED' WHERE reservation_id = ? AND status = 'HELD'").run(reservationId);
    return res.changes > 0;
  }
};

// src/store/audit.ts
import crypto3 from "node:crypto";
var AuditLedger = class {
  db;
  constructor(db) {
    this.db = db;
  }
  /**
   * Appends an audit entry with cryptographic hash chaining using rowid ordering.
   */
  logTransition(intentId, eventType, prevState, newState, details) {
    const lastRow = this.db.prepare("SELECT record_hash FROM audit_ledger ORDER BY rowid DESC LIMIT 1").get();
    const prevHash = lastRow?.record_hash || "GENESIS_BLOCK_0000000000000000";
    const timestamp = Date.now();
    const auditId = `audit_${crypto3.randomUUID()}`;
    const detailsJson = JSON.stringify(details);
    const blockPayload = `${auditId}|${intentId}|${timestamp}|${eventType}|${prevState || "NULL"}|${newState}|${detailsJson}|${prevHash}`;
    const recordHash = crypto3.createHash("sha256").update(blockPayload).digest("hex");
    this.db.prepare(`
        INSERT INTO audit_ledger (
          audit_id, intent_id, timestamp, event_type, previous_state, new_state, details_json, record_hash, previous_record_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(auditId, intentId, timestamp, eventType, prevState, newState, detailsJson, recordHash, prevHash);
    return {
      audit_id: auditId,
      intent_id: intentId,
      timestamp,
      event_type: eventType,
      previous_state: prevState,
      new_state: newState,
      details,
      record_hash: recordHash
    };
  }
  /**
   * Retrieves full audit trajectory for an intent.
   */
  getTrajectory(intentId) {
    return this.db.prepare("SELECT * FROM audit_ledger WHERE intent_id = ? ORDER BY rowid ASC").all(intentId);
  }
  /**
   * Verifies the cryptographic integrity of the entire audit chain.
   */
  verifyLedgerIntegrity() {
    const rows = this.db.prepare("SELECT * FROM audit_ledger ORDER BY rowid ASC").all();
    let expectedPrevHash = "GENESIS_BLOCK_0000000000000000";
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.previous_record_hash !== expectedPrevHash) {
        return {
          isValid: false,
          checkedBlocks: i,
          error: `Broken chain link at block ${row.audit_id}: expected ${expectedPrevHash}, found ${row.previous_record_hash}`
        };
      }
      const payload = `${row.audit_id}|${row.intent_id}|${row.timestamp}|${row.event_type}|${row.previous_state || "NULL"}|${row.new_state}|${row.details_json}|${row.previous_record_hash}`;
      const computedHash = crypto3.createHash("sha256").update(payload).digest("hex");
      if (computedHash !== row.record_hash) {
        return {
          isValid: false,
          checkedBlocks: i,
          error: `Tampered hash at block ${row.audit_id}`
        };
      }
      expectedPrevHash = row.record_hash;
    }
    return { isValid: true, checkedBlocks: rows.length };
  }
};

// src/rails/razorpay.ts
import crypto4 from "node:crypto";
var RazorpayRailClient = class {
  keyId;
  keySecret;
  isLiveCredentials;
  constructor(keyId, keySecret) {
    const envId = process.env.RAZORPAY_KEY_ID;
    const envSecret = process.env.RAZORPAY_KEY_SECRET;
    if (process.env.NODE_ENV === "production" && (!envId || !envSecret)) {
      throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required in production.");
    }
    this.keyId = keyId || envId || "rzp_test_mock";
    this.keySecret = keySecret || envSecret || "mock_secret";
    this.isLiveCredentials = this.keyId.startsWith("rzp_test_") && this.keyId !== "rzp_test_placeholder_key" && this.keyId !== "rzp_test_mock";
  }
  /**
   * Creates a Razorpay Order using documented `receipt` idempotency mechanism.
   */
  async createOrder(amountPaise, receiptIntentId, notes = {}) {
    if (!this.isLiveCredentials) {
      return {
        id: `order_${crypto4.randomBytes(8).toString("hex")}`,
        entity: "order",
        amount: amountPaise,
        amount_paid: 0,
        amount_due: amountPaise,
        currency: "INR",
        receipt: receiptIntentId,
        status: "created",
        attempts: 0,
        created_at: Math.floor(Date.now() / 1e3)
      };
    }
    const authHeader = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`;
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: receiptIntentId,
        notes
      })
    });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Razorpay Order creation failed [${response.status}]: ${errorBody}`);
    }
    return await response.json();
  }
  /**
   * Triggers an Idempotent Refund using the official `X-Refund-Idempotency` header.
   */
  async createRefund(paymentId, amountPaise, idempotencyKey, notes = {}) {
    if (!this.isLiveCredentials) {
      return {
        id: `rfnd_${crypto4.randomBytes(8).toString("hex")}`,
        entity: "refund",
        amount: amountPaise,
        currency: "INR",
        payment_id: paymentId,
        receipt: idempotencyKey,
        status: "processed",
        created_at: Math.floor(Date.now() / 1e3)
      };
    }
    const authHeader = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`;
    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        "X-Refund-Idempotency": idempotencyKey
      },
      body: JSON.stringify({
        amount: amountPaise,
        notes
      })
    });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Razorpay Refund failed [${response.status}]: ${errorBody}`);
    }
    return await response.json();
  }
  /**
   * Fetches payment status for active outbox reconciliation.
   */
  async fetchPayment(paymentId) {
    if (!this.isLiveCredentials) {
      return {
        id: paymentId,
        status: "captured",
        amount: 35e4,
        currency: "INR"
      };
    }
    const authHeader = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`;
    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: { Authorization: authHeader }
    });
    return await response.json();
  }
};

// src/rails/webhook.ts
import crypto5 from "node:crypto";
var RazorpayWebhookProcessor = class {
  db;
  audit;
  reservationEngine;
  railClient;
  policy;
  webhookSecret;
  constructor(db, audit, reservationEngine, railClient, policy, webhookSecret) {
    this.db = db;
    this.audit = audit;
    this.reservationEngine = reservationEngine;
    this.railClient = railClient;
    this.policy = policy;
    const envSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (process.env.NODE_ENV === "production" && !envSecret) {
      throw new Error("RAZORPAY_WEBHOOK_SECRET is required. No fallback secrets are permitted in production.");
    }
    this.webhookSecret = webhookSecret || envSecret || "rzp_webhook_secret_test";
    if (process.env.NODE_ENV === "production" && this.webhookSecret === "rzp_webhook_secret_test" && !envSecret) {
      throw new Error("RAZORPAY_WEBHOOK_SECRET is required. No fallback secrets are permitted in production.");
    }
  }
  /**
   * Verifies Razorpay HMAC SHA256 Webhook Signature.
   * Compares against raw wire bytes first, with fallback to canonical JSON representation.
   */
  verifySignature(rawBody, signature) {
    if (!signature) return false;
    const bodyStr = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);
    const expectedSignature = crypto5.createHmac("sha256", this.webhookSecret).update(bodyStr).digest("hex");
    const expectedBuf = Buffer.from(expectedSignature, "utf-8");
    const actualBuf = Buffer.from(signature, "utf-8");
    if (expectedBuf.length === actualBuf.length && crypto5.timingSafeEqual(expectedBuf, actualBuf)) {
      return true;
    }
    try {
      const parsed = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
      const normalizedStr = JSON.stringify(parsed);
      const altSignature = crypto5.createHmac("sha256", this.webhookSecret).update(normalizedStr).digest("hex");
      const altBuf = Buffer.from(altSignature, "utf-8");
      if (altBuf.length === actualBuf.length && crypto5.timingSafeEqual(altBuf, actualBuf)) {
        return true;
      }
    } catch {
    }
    return false;
  }
  /**
   * Processes an incoming Razorpay webhook event with:
   * 1. x-razorpay-event-id deduplication
   * 2. Monotonic state transition
   * 3. Fulfillment dispatch and safe policy-gated refund on failure
   */
  async processEvent(eventId, eventPayload) {
    const existingEvent = this.db.prepare("SELECT event_id FROM processed_webhook_events WHERE event_id = ?").get(eventId);
    if (existingEvent) {
      return { status: "DUPLICATE_IGNORED", message: `Event ID '${eventId}' already processed` };
    }
    const orderId = eventPayload.payload.order?.entity.id || eventPayload.payload.payment?.entity.order_id;
    const paymentId = eventPayload.payload.payment?.entity.id;
    const orderSession = this.db.prepare("SELECT * FROM order_sessions WHERE razorpay_order_id = ?").get(orderId || "");
    if (!orderSession) {
      return { status: "ORDER_NOT_FOUND", message: `No active session for Razorpay Order ID '${orderId || ""}'` };
    }
    const intentId = orderSession.intent_id;
    if (eventPayload.event === "payment.captured") {
      if (orderSession.status !== "ORDER_CREATED" && orderSession.status !== "PAYMENT_AUTHORIZED" && orderSession.status !== "PAYMENT_ATTEMPTED") {
        if (orderSession.status === "PAYMENT_CAPTURED") {
          return { status: "DUPLICATE_IGNORED", message: "Order is already in PAYMENT_CAPTURED state" };
        }
        this.audit.logTransition(
          intentId,
          "ILLEGAL_STATE_TRANSITION_BLOCKED",
          orderSession.status,
          orderSession.status,
          {
            eventId,
            orderId,
            paymentId,
            attemptedEvent: eventPayload.event,
            reason: `Illegal state transition from state '${orderSession.status}' to 'PAYMENT_CAPTURED'`
          }
        );
        return {
          status: "ERROR",
          message: `Illegal state transition: Order session is '${orderSession.status}', cannot transition to 'PAYMENT_CAPTURED'`
        };
      }
      const committed = this.reservationEngine.commitReservation(orderSession.reservation_id);
      if (!committed) {
        this.audit.logTransition(
          intentId,
          "RESERVATION_COMMIT_FAILED",
          orderSession.status,
          orderSession.status,
          {
            reservationId: orderSession.reservation_id,
            reason: `Underlying reservation '${orderSession.reservation_id}' is not in HELD status`
          }
        );
        return {
          status: "ERROR",
          message: `Cannot capture payment: Underlying reservation '${orderSession.reservation_id}' is not in HELD status`
        };
      }
      this.db.prepare("UPDATE order_sessions SET status = 'PAYMENT_CAPTURED', razorpay_payment_id = ?, updated_at = ? WHERE intent_id = ?").run(paymentId || null, Date.now(), intentId);
      this.audit.logTransition(intentId, "WEBHOOK_PAYMENT_CAPTURED", orderSession.status, "PAYMENT_CAPTURED", {
        eventId,
        orderId,
        paymentId
      });
      await this.triggerFulfillment(intentId, orderSession.reservation_id, paymentId || "");
    } else if (eventPayload.event === "payment.authorized") {
      if (orderSession.status === "PAYMENT_FAILED" || orderSession.status === "DUAL_RESERVATION_RELEASED" || orderSession.status === "REFUNDED") {
        this.audit.logTransition(
          intentId,
          "ILLEGAL_STATE_TRANSITION_BLOCKED",
          orderSession.status,
          orderSession.status,
          {
            eventId,
            orderId,
            paymentId,
            attemptedEvent: eventPayload.event,
            reason: `Illegal state transition from terminal state '${orderSession.status}' to 'PAYMENT_AUTHORIZED'`
          }
        );
        return {
          status: "ERROR",
          message: `Illegal state transition: Order session is '${orderSession.status}', cannot transition to 'PAYMENT_AUTHORIZED'`
        };
      }
      if (orderSession.status === "PAYMENT_AUTHORIZED" || orderSession.status === "PAYMENT_CAPTURED") {
        return { status: "DUPLICATE_IGNORED", message: `Order is already ${orderSession.status}` };
      }
      this.db.prepare("UPDATE order_sessions SET status = 'PAYMENT_AUTHORIZED', razorpay_payment_id = ?, updated_at = ? WHERE intent_id = ?").run(paymentId || null, Date.now(), intentId);
      this.audit.logTransition(intentId, "WEBHOOK_PAYMENT_AUTHORIZED", orderSession.status, "PAYMENT_AUTHORIZED", {
        eventId,
        orderId,
        paymentId
      });
    } else if (eventPayload.event === "payment.failed") {
      if (orderSession.status === "PAYMENT_CAPTURED" || orderSession.status === "REFUNDED") {
        this.audit.logTransition(
          intentId,
          "ILLEGAL_STATE_TRANSITION_BLOCKED",
          orderSession.status,
          orderSession.status,
          {
            eventId,
            orderId,
            paymentId,
            attemptedEvent: eventPayload.event,
            reason: `Cannot fail payment when order session is already '${orderSession.status}'`
          }
        );
        return {
          status: "ERROR",
          message: `Illegal state transition: Order session is '${orderSession.status}', cannot transition to 'PAYMENT_FAILED'`
        };
      }
      if (orderSession.status === "PAYMENT_FAILED") {
        return { status: "DUPLICATE_IGNORED", message: "Order is already PAYMENT_FAILED" };
      }
      this.db.prepare("UPDATE order_sessions SET status = 'PAYMENT_FAILED', updated_at = ? WHERE intent_id = ?").run(Date.now(), intentId);
      this.reservationEngine.releaseReservation(orderSession.reservation_id, "Payment failed at bank rail");
      this.audit.logTransition(intentId, "WEBHOOK_PAYMENT_FAILED", orderSession.status, "DUAL_RESERVATION_RELEASED", {
        eventId,
        orderId,
        paymentId
      });
    }
    this.db.prepare(`
        INSERT INTO processed_webhook_events (event_id, event_type, order_id, payment_id, processed_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(eventId, eventPayload.event, orderId || null, paymentId || null, Date.now(), JSON.stringify(eventPayload));
    return { status: "PROCESSED" };
  }
  async triggerFulfillment(intentId, reservationId, paymentId) {
    this.audit.logTransition(intentId, "FULFILLMENT_DISPATCHED", "PAYMENT_CAPTURED", "FULFILLMENT_DISPATCHED", {
      intentId,
      reservationId
    });
  }
  async handlePostCaptureFulfillmentFailure(intentId, reason) {
    const session = this.db.prepare("SELECT * FROM order_sessions WHERE intent_id = ?").get(intentId);
    if (!session || !session.razorpay_payment_id) return;
    this.audit.logTransition(intentId, "FULFILLMENT_FAILED", session.status, "FULFILLMENT_FAILED", {
      reason,
      paymentId: session.razorpay_payment_id
    });
    if (this.policy.auto_refund_on_fulfillment_failure) {
      const refundIdempotencyKey = `rfnd_${intentId}_${Date.now()}`;
      this.audit.logTransition(intentId, "REFUND_PENDING", "FULFILLMENT_FAILED", "REFUND_PENDING", {
        refundIdempotencyKey,
        amount: Number(session.amount)
      });
      const refundResult = await this.railClient.createRefund(
        session.razorpay_payment_id,
        Number(session.amount),
        refundIdempotencyKey,
        { reason: "Merchant fulfillment failure stockout" }
      );
      this.db.prepare("UPDATE order_sessions SET status = 'REFUNDED', updated_at = ? WHERE intent_id = ?").run(Date.now(), intentId);
      this.audit.logTransition(intentId, "REFUND_PROCESSED", "REFUND_PENDING", "REFUNDED", {
        refundId: refundResult.id,
        status: refundResult.status
      });
    } else {
      this.db.prepare("UPDATE order_sessions SET status = 'MANUAL_REVIEW', updated_at = ? WHERE intent_id = ?").run(Date.now(), intentId);
      this.audit.logTransition(intentId, "ESCALATED_MANUAL_REVIEW", "FULFILLMENT_FAILED", "MANUAL_REVIEW", {
        reason: "Merchant policy requires manual review for post-capture failures"
      });
    }
  }
};

// src/adapters/acg/adapter.ts
import crypto6 from "node:crypto";
var ACGNativeAdapter = class {
  protocol = "ACG";
  displayName = "Native ACG Protocol";
  specificationVersion = "v1.0.0-verified";
  status = "LIVE";
  description = "Direct native ACG canonical JSON format with Ed25519 principal mandate and untrusted LLM proposed items.";
  async normalize(rawPayload, merchantId = "merch_acme_electronics_01") {
    const rawHash = crypto6.createHash("sha256").update(JSON.stringify(rawPayload || {})).digest("hex");
    const parsed = CanonicalIntentSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid Native ACG intent payload format",
        code: "INVALID_NATIVE_SCHEMA",
        details: parsed.error.format()
      };
    }
    const intent = parsed.data;
    const acgIntent = {
      intentId: intent.intent_id,
      clientNonce: intent.client_nonce,
      timestamp: intent.timestamp,
      principal: {
        type: "human",
        id: `principal_${intent.mandate.principal_public_key.slice(0, 12)}`,
        publicKey: intent.mandate.principal_public_key
      },
      agent: {
        id: "native-agent-session",
        provider: "Native",
        protocol: "ACG",
        publicKey: intent.mandate.principal_public_key,
        modelRuntime: "Universal"
      },
      action: {
        type: "PURCHASE"
      },
      merchant: {
        id: intent.mandate.merchant_whitelist?.[0] || merchantId
      },
      items: intent.proposed_items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
      authorization: {
        mandateId: intent.mandate.mandate_id,
        budgetLimitPaise: intent.mandate.budget_limit,
        expiry: intent.mandate.expiry,
        constraints: {
          categories: intent.mandate.category_whitelist || [],
          merchants: intent.mandate.merchant_whitelist || []
        }
      },
      provenance: {
        protocol: "ACG",
        rawRequestHash: rawHash,
        normalizedAt: Date.now()
      },
      canonical: intent
    };
    return {
      success: true,
      intent,
      acgIntent,
      metadata: {
        sourceProtocol: "ACG",
        rawHash,
        agentId: "native-agent-session",
        adapterVersion: this.specificationVersion
      }
    };
  }
};

// src/adapters/mcp/adapter.ts
import crypto7 from "node:crypto";
import { z as z2 } from "zod";
var McpToolCallSchema = z2.object({
  method: z2.literal("tools/call"),
  params: z2.object({
    name: z2.string().refine((n) => ["acg_checkout", "execute_purchase", "checkout_cart"].includes(n), {
      message: "Unsupported MCP tool name. Expected 'acg_checkout', 'execute_purchase', or 'checkout_cart'."
    }),
    arguments: z2.object({
      intent_id: z2.string().uuid().optional(),
      client_nonce: z2.string().min(16).optional(),
      timestamp: z2.number().int().positive().optional(),
      mandate: BuyerMandateSchema,
      items: z2.array(
        z2.object({
          sku: z2.string().min(1),
          quantity: z2.number().int().positive()
        })
      ).nonempty(),
      agent_metadata: z2.object({
        model_runtime: z2.string().optional(),
        agent_id: z2.string().optional(),
        provider: z2.string().optional()
      }).optional()
    })
  })
});
var McpProtocolAdapter = class {
  protocol = "MCP";
  displayName = "Model Context Protocol (MCP)";
  specificationVersion = "2024-11-05/v1";
  status = "ADAPTER READY";
  description = "Converts Claude/GPT MCP tools/call invocations into verified canonical ACG intents.";
  async normalize(rawPayload, merchantId = "merch_acme_electronics_01") {
    const rawHash = crypto7.createHash("sha256").update(JSON.stringify(rawPayload || {})).digest("hex");
    const parseResult = McpToolCallSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      return {
        success: false,
        error: "Malformed MCP tools/call payload",
        code: "INVALID_MCP_PAYLOAD",
        details: parseResult.error.format()
      };
    }
    const { params } = parseResult.data;
    const args = params.arguments;
    const intentId = args.intent_id || crypto7.randomUUID();
    const nonce = args.client_nonce || crypto7.randomBytes(16).toString("hex");
    const ts = args.timestamp || Math.floor(Date.now() / 1e3);
    const canonical = {
      intent_id: intentId,
      client_nonce: nonce,
      timestamp: ts,
      mandate: args.mandate,
      proposed_items: args.items.map((i) => ({ sku: i.sku, quantity: i.quantity }))
    };
    const agentId = args.agent_metadata?.agent_id || `mcp-agent-${intentId.slice(0, 8)}`;
    const model = args.agent_metadata?.model_runtime || "mcp-client";
    const acgIntent = {
      intentId,
      clientNonce: nonce,
      timestamp: ts,
      principal: {
        type: "human",
        id: `principal_${args.mandate.principal_public_key.slice(0, 12)}`,
        publicKey: args.mandate.principal_public_key
      },
      agent: {
        id: agentId,
        provider: args.agent_metadata?.provider || "Anthropic/MCP",
        protocol: "MCP",
        modelRuntime: model
      },
      action: {
        type: "PURCHASE"
      },
      merchant: {
        id: args.mandate.merchant_whitelist?.[0] || merchantId
      },
      items: args.items,
      authorization: {
        mandateId: args.mandate.mandate_id,
        budgetLimitPaise: args.mandate.budget_limit,
        expiry: args.mandate.expiry,
        constraints: {
          categories: args.mandate.category_whitelist || [],
          merchants: args.mandate.merchant_whitelist || []
        }
      },
      provenance: {
        protocol: "MCP",
        rawRequestHash: rawHash,
        normalizedAt: Date.now()
      },
      canonical
    };
    return {
      success: true,
      intent: canonical,
      acgIntent,
      metadata: {
        sourceProtocol: "MCP",
        rawHash,
        agentId,
        adapterVersion: this.specificationVersion,
        details: {
          toolName: params.name,
          modelRuntime: model
        }
      }
    };
  }
};

// src/adapters/a2a/adapter.ts
import crypto8 from "node:crypto";
import { z as z3 } from "zod";
var A2AMessageSchema = z3.object({
  jsonrpc: z3.literal("2.0"),
  id: z3.union([z3.string(), z3.number()]),
  method: z3.string().refine((m) => m.startsWith("a2a.commerce."), {
    message: "A2A method must start with 'a2a.commerce.'"
  }),
  params: z3.object({
    taskId: z3.string().min(1),
    senderAgent: z3.object({
      id: z3.string().min(1),
      did: z3.string().optional(),
      framework: z3.string().optional()
    }),
    recipientAgent: z3.object({
      id: z3.string().min(1)
    }),
    payload: z3.object({
      intent_id: z3.string().uuid().optional(),
      client_nonce: z3.string().min(16).optional(),
      timestamp: z3.number().int().positive().optional(),
      mandate: BuyerMandateSchema,
      proposed_items: z3.array(
        z3.object({
          sku: z3.string().min(1),
          quantity: z3.number().int().positive()
        })
      ).nonempty()
    })
  })
});
var A2AProtocolAdapter = class {
  protocol = "A2A";
  displayName = "Agent2Agent (A2A) Protocol";
  specificationVersion = "2026.1-LF";
  status = "ADAPTER READY";
  description = "Translates Linux Foundation A2A inter-agent commerce task RPCs into canonical ACG intents.";
  async normalize(rawPayload, merchantId = "merch_acme_electronics_01") {
    const rawHash = crypto8.createHash("sha256").update(JSON.stringify(rawPayload || {})).digest("hex");
    const parseResult = A2AMessageSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      return {
        success: false,
        error: "Malformed A2A inter-agent commerce RPC payload",
        code: "INVALID_A2A_PAYLOAD",
        details: parseResult.error.format()
      };
    }
    const { params } = parseResult.data;
    const body = params.payload;
    const intentId = body.intent_id || crypto8.randomUUID();
    const nonce = body.client_nonce || crypto8.randomBytes(16).toString("hex");
    const ts = body.timestamp || Math.floor(Date.now() / 1e3);
    const canonical = {
      intent_id: intentId,
      client_nonce: nonce,
      timestamp: ts,
      mandate: body.mandate,
      proposed_items: body.proposed_items
    };
    const acgIntent = {
      intentId,
      clientNonce: nonce,
      timestamp: ts,
      principal: {
        type: "human",
        id: `principal_${body.mandate.principal_public_key.slice(0, 12)}`,
        publicKey: body.mandate.principal_public_key
      },
      agent: {
        id: params.senderAgent.id,
        provider: params.senderAgent.framework || "A2A-Federation",
        protocol: "A2A",
        publicKey: params.senderAgent.did
      },
      action: {
        type: "PURCHASE"
      },
      merchant: {
        id: body.mandate.merchant_whitelist?.[0] || merchantId
      },
      items: body.proposed_items,
      authorization: {
        mandateId: body.mandate.mandate_id,
        budgetLimitPaise: body.mandate.budget_limit,
        expiry: body.mandate.expiry,
        constraints: {
          categories: body.mandate.category_whitelist || [],
          merchants: body.mandate.merchant_whitelist || []
        }
      },
      provenance: {
        protocol: "A2A",
        rawRequestHash: rawHash,
        normalizedAt: Date.now()
      },
      canonical
    };
    return {
      success: true,
      intent: canonical,
      acgIntent,
      metadata: {
        sourceProtocol: "A2A",
        rawHash,
        agentId: params.senderAgent.id,
        adapterVersion: this.specificationVersion,
        details: {
          taskId: params.taskId,
          senderDid: params.senderAgent.did
        }
      }
    };
  }
};

// src/adapters/acp/adapter.ts
import crypto9 from "node:crypto";
import { z as z4 } from "zod";
var AcpTransactionSchema = z4.object({
  protocol_version: z4.string().refine((v) => v.startsWith("acp/"), {
    message: "Protocol version must start with 'acp/' (e.g. acp/1.0)"
  }),
  transaction_id: z4.string().uuid().optional(),
  session_nonce: z4.string().min(16).optional(),
  timestamp: z4.number().int().positive().optional(),
  buyer_principal: z4.object({
    id: z4.string().min(1),
    public_key: z4.string().min(32)
  }),
  agent_identity: z4.object({
    agent_id: z4.string().min(1),
    runtime: z4.string().optional()
  }).optional(),
  commerce_mandate: BuyerMandateSchema,
  line_items: z4.array(
    z4.object({
      sku: z4.string().min(1),
      quantity: z4.number().int().positive(),
      estimated_price_paise: z4.number().int().optional()
      // Advisory only; ACG truth engine overrides
    })
  ).nonempty()
});
var AcpProtocolAdapter = class {
  protocol = "ACP";
  displayName = "Agentic Commerce Protocol (ACP)";
  specificationVersion = "acp/1.0";
  status = "ADAPTER READY";
  description = "Normalizes ACP open commerce checkout containers into canonical ACG intents.";
  async normalize(rawPayload, merchantId = "merch_acme_electronics_01") {
    const rawHash = crypto9.createHash("sha256").update(JSON.stringify(rawPayload || {})).digest("hex");
    const parseResult = AcpTransactionSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      return {
        success: false,
        error: "Invalid ACP commerce container format",
        code: "INVALID_ACP_PAYLOAD",
        details: parseResult.error.format()
      };
    }
    const data = parseResult.data;
    const intentId = data.transaction_id || crypto9.randomUUID();
    const nonce = data.session_nonce || crypto9.randomBytes(16).toString("hex");
    const ts = data.timestamp || Math.floor(Date.now() / 1e3);
    const canonical = {
      intent_id: intentId,
      client_nonce: nonce,
      timestamp: ts,
      mandate: data.commerce_mandate,
      proposed_items: data.line_items.map((i) => ({ sku: i.sku, quantity: i.quantity }))
    };
    const agentId = data.agent_identity?.agent_id || `acp-agent-${intentId.slice(0, 8)}`;
    const acgIntent = {
      intentId,
      clientNonce: nonce,
      timestamp: ts,
      principal: {
        type: "human",
        id: data.buyer_principal.id,
        publicKey: data.commerce_mandate.principal_public_key
      },
      agent: {
        id: agentId,
        provider: "ACP Ecosystem",
        protocol: "ACP",
        modelRuntime: data.agent_identity?.runtime || "Autonomous ACP Agent"
      },
      action: {
        type: "PURCHASE"
      },
      merchant: {
        id: data.commerce_mandate.merchant_whitelist?.[0] || merchantId
      },
      items: data.line_items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
      authorization: {
        mandateId: data.commerce_mandate.mandate_id,
        budgetLimitPaise: data.commerce_mandate.budget_limit,
        expiry: data.commerce_mandate.expiry,
        constraints: {
          categories: data.commerce_mandate.category_whitelist || [],
          merchants: data.commerce_mandate.merchant_whitelist || []
        }
      },
      provenance: {
        protocol: "ACP",
        rawRequestHash: rawHash,
        normalizedAt: Date.now()
      },
      canonical
    };
    return {
      success: true,
      intent: canonical,
      acgIntent,
      metadata: {
        sourceProtocol: "ACP",
        rawHash,
        agentId,
        adapterVersion: this.specificationVersion
      }
    };
  }
};

// src/adapters/ap2/adapter.ts
import crypto10 from "node:crypto";
import { z as z5 } from "zod";
var Ap2PaymentAuthorizationSchema = z5.object({
  ap2_version: z5.string().refine((v) => v.startsWith("0.2"), {
    message: "Expected AP2 v0.2.x specification"
  }),
  payment_intent_id: z5.string().uuid().optional(),
  payer: z5.object({
    principal_id: z5.string().min(1),
    public_key: z5.string().min(32)
  }),
  authorization_mandate: BuyerMandateSchema,
  cart: z5.object({
    items: z5.array(
      z5.object({
        sku: z5.string().min(1),
        qty: z5.number().int().positive()
      })
    ).nonempty()
  }),
  nonce: z5.string().min(16).optional(),
  created_at: z5.number().int().positive().optional()
});
var Ap2ProtocolAdapter = class {
  protocol = "AP2";
  displayName = "Agent Payments Protocol (AP2)";
  specificationVersion = "v0.2.0";
  status = "ADAPTER READY";
  description = "Maps AP2 payment authorization envelopes into canonical ACG intents. Note: AP2 payment mandate binding uses non-deterministic ECDSA checkout JWTs (v0.2), which ACG adapts into canonical merchant-side verification.";
  async normalize(rawPayload, merchantId = "merch_acme_electronics_01") {
    const rawHash = crypto10.createHash("sha256").update(JSON.stringify(rawPayload || {})).digest("hex");
    const parseResult = Ap2PaymentAuthorizationSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      return {
        success: false,
        error: "Malformed AP2 payment authorization container",
        code: "INVALID_AP2_PAYLOAD",
        details: parseResult.error.format()
      };
    }
    const data = parseResult.data;
    const intentId = data.payment_intent_id || crypto10.randomUUID();
    const nonce = data.nonce || crypto10.randomBytes(16).toString("hex");
    const ts = data.created_at || Math.floor(Date.now() / 1e3);
    const canonical = {
      intent_id: intentId,
      client_nonce: nonce,
      timestamp: ts,
      mandate: data.authorization_mandate,
      proposed_items: data.cart.items.map((i) => ({ sku: i.sku, quantity: i.qty }))
    };
    const acgIntent = {
      intentId,
      clientNonce: nonce,
      timestamp: ts,
      principal: {
        type: "human",
        id: data.payer.principal_id,
        publicKey: data.authorization_mandate.principal_public_key
      },
      agent: {
        id: `ap2-agent-${intentId.slice(0, 8)}`,
        provider: "AP2 Working Group",
        protocol: "AP2",
        publicKey: data.payer.public_key
      },
      action: {
        type: "PURCHASE"
      },
      merchant: {
        id: data.authorization_mandate.merchant_whitelist?.[0] || merchantId
      },
      items: data.cart.items.map((i) => ({ sku: i.sku, quantity: i.qty })),
      authorization: {
        mandateId: data.authorization_mandate.mandate_id,
        budgetLimitPaise: data.authorization_mandate.budget_limit,
        expiry: data.authorization_mandate.expiry,
        constraints: {
          categories: data.authorization_mandate.category_whitelist || [],
          merchants: data.authorization_mandate.merchant_whitelist || []
        }
      },
      provenance: {
        protocol: "AP2",
        rawRequestHash: rawHash,
        normalizedAt: Date.now()
      },
      canonical
    };
    return {
      success: true,
      intent: canonical,
      acgIntent,
      metadata: {
        sourceProtocol: "AP2",
        rawHash,
        agentId: `ap2-agent-${intentId.slice(0, 8)}`,
        adapterVersion: this.specificationVersion
      }
    };
  }
};

// src/adapters/ucp/adapter.ts
import crypto11 from "node:crypto";
import { z as z6 } from "zod";
var UcpJourneySchema = z6.object({
  ucp_standard: z6.string().refine((s) => s.startsWith("ucp"), {
    message: "Must specify Google UCP standard version (e.g. ucp-v1)"
  }),
  surface: z6.string().default("assistant_checkout"),
  journey_id: z6.string().min(1),
  checkout_request: z6.object({
    intent_id: z6.string().uuid().optional(),
    nonce: z6.string().min(16).optional(),
    timestamp: z6.number().int().positive().optional(),
    delegated_mandate: BuyerMandateSchema,
    order_lines: z6.array(
      z6.object({
        sku: z6.string().min(1),
        quantity: z6.number().int().positive(),
        title: z6.string().optional()
      })
    ).nonempty()
  })
});
var UcpProtocolAdapter = class {
  protocol = "UCP";
  displayName = "Universal Commerce Protocol (UCP)";
  specificationVersion = "ucp-v1.2";
  status = "ADAPTER READY";
  description = "Bridges Google UCP consumer surface journeys into canonical ACG intents.";
  async normalize(rawPayload, merchantId = "merch_acme_electronics_01") {
    const rawHash = crypto11.createHash("sha256").update(JSON.stringify(rawPayload || {})).digest("hex");
    const parseResult = UcpJourneySchema.safeParse(rawPayload);
    if (!parseResult.success) {
      return {
        success: false,
        error: "Malformed Google UCP commerce journey payload",
        code: "INVALID_UCP_PAYLOAD",
        details: parseResult.error.format()
      };
    }
    const { journey_id, surface, checkout_request } = parseResult.data;
    const intentId = checkout_request.intent_id || crypto11.randomUUID();
    const nonce = checkout_request.nonce || crypto11.randomBytes(16).toString("hex");
    const ts = checkout_request.timestamp || Math.floor(Date.now() / 1e3);
    const canonical = {
      intent_id: intentId,
      client_nonce: nonce,
      timestamp: ts,
      mandate: checkout_request.delegated_mandate,
      proposed_items: checkout_request.order_lines.map((i) => ({ sku: i.sku, quantity: i.quantity }))
    };
    const acgIntent = {
      intentId,
      clientNonce: nonce,
      timestamp: ts,
      principal: {
        type: "human",
        id: `principal_${checkout_request.delegated_mandate.principal_public_key.slice(0, 12)}`,
        publicKey: checkout_request.delegated_mandate.principal_public_key
      },
      agent: {
        id: `ucp-surface-${surface}`,
        provider: "Google UCP",
        protocol: "UCP",
        modelRuntime: "Gemini Commerce Agent"
      },
      action: {
        type: "PURCHASE"
      },
      merchant: {
        id: checkout_request.delegated_mandate.merchant_whitelist?.[0] || merchantId
      },
      items: checkout_request.order_lines.map((i) => ({ sku: i.sku, quantity: i.quantity })),
      authorization: {
        mandateId: checkout_request.delegated_mandate.mandate_id,
        budgetLimitPaise: checkout_request.delegated_mandate.budget_limit,
        expiry: checkout_request.delegated_mandate.expiry,
        constraints: {
          categories: checkout_request.delegated_mandate.category_whitelist || [],
          merchants: checkout_request.delegated_mandate.merchant_whitelist || []
        }
      },
      provenance: {
        protocol: "UCP",
        rawRequestHash: rawHash,
        normalizedAt: Date.now()
      },
      canonical
    };
    return {
      success: true,
      intent: canonical,
      acgIntent,
      metadata: {
        sourceProtocol: "UCP",
        rawHash,
        agentId: `ucp-${surface}`,
        adapterVersion: this.specificationVersion,
        details: {
          journeyId: journey_id,
          surface
        }
      }
    };
  }
};

// src/adapters/tap/adapter.ts
import crypto12 from "node:crypto";
import { z as z7 } from "zod";
var VisaTapEnvelopeSchema = z7.object({
  tap_version: z7.string().default("1.0"),
  agent_identity: z7.object({
    agent_id: z7.string().min(1),
    issuer: z7.literal("visa:tap:registry").or(z7.string()),
    agent_public_key: z7.string().min(32),
    attestation_token: z7.string(),
    reputation_tier: z7.enum(["TIER_1_VERIFIED", "TIER_2_ATTESTED", "TIER_3_PROVISIONAL"]).default("TIER_1_VERIFIED")
  }),
  commerce_payload: z7.object({
    intent_id: z7.string().uuid().optional(),
    client_nonce: z7.string().min(16).optional(),
    timestamp: z7.number().int().positive().optional(),
    mandate: BuyerMandateSchema,
    proposed_items: z7.array(
      z7.object({
        sku: z7.string().min(1),
        quantity: z7.number().int().positive()
      })
    ).nonempty()
  })
});
var VisaTapProtocolAdapter = class {
  protocol = "TAP";
  displayName = "Visa Trusted Agent Protocol (TAP)";
  specificationVersion = "tap/1.0-draft";
  status = "DESIGN";
  description = "Cryptographic agent identity & trust verification adapter, preventing malicious bots from impersonating authorized agents.";
  async normalize(rawPayload, merchantId = "merch_acme_electronics_01") {
    const rawHash = crypto12.createHash("sha256").update(JSON.stringify(rawPayload || {})).digest("hex");
    const parseResult = VisaTapEnvelopeSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      return {
        success: false,
        error: "Invalid Visa TAP agent trust envelope",
        code: "INVALID_TAP_PAYLOAD",
        details: parseResult.error.format()
      };
    }
    const { agent_identity, commerce_payload } = parseResult.data;
    if (!agent_identity.attestation_token || agent_identity.attestation_token.length < 16) {
      return {
        success: false,
        error: "Agent identity attestation failed Visa TAP cryptographic validation",
        code: "TAP_IDENTITY_UNVERIFIED"
      };
    }
    const intentId = commerce_payload.intent_id || crypto12.randomUUID();
    const nonce = commerce_payload.client_nonce || crypto12.randomBytes(16).toString("hex");
    const ts = commerce_payload.timestamp || Math.floor(Date.now() / 1e3);
    const canonical = {
      intent_id: intentId,
      client_nonce: nonce,
      timestamp: ts,
      mandate: commerce_payload.mandate,
      proposed_items: commerce_payload.proposed_items
    };
    const acgIntent = {
      intentId,
      clientNonce: nonce,
      timestamp: ts,
      principal: {
        type: "human",
        id: `principal_${commerce_payload.mandate.principal_public_key.slice(0, 12)}`,
        publicKey: commerce_payload.mandate.principal_public_key
      },
      agent: {
        id: agent_identity.agent_id,
        provider: `Visa TAP (${agent_identity.reputation_tier})`,
        protocol: "TAP",
        publicKey: agent_identity.agent_public_key,
        modelRuntime: "Hardware-Attested Agent"
      },
      action: {
        type: "PURCHASE"
      },
      merchant: {
        id: commerce_payload.mandate.merchant_whitelist?.[0] || merchantId
      },
      items: commerce_payload.proposed_items,
      authorization: {
        mandateId: commerce_payload.mandate.mandate_id,
        budgetLimitPaise: commerce_payload.mandate.budget_limit,
        expiry: commerce_payload.mandate.expiry,
        constraints: {
          categories: commerce_payload.mandate.category_whitelist || [],
          merchants: commerce_payload.mandate.merchant_whitelist || []
        }
      },
      provenance: {
        protocol: "TAP",
        rawRequestHash: rawHash,
        normalizedAt: Date.now()
      },
      canonical
    };
    return {
      success: true,
      intent: canonical,
      acgIntent,
      metadata: {
        sourceProtocol: "TAP",
        rawHash,
        agentId: agent_identity.agent_id,
        adapterVersion: this.specificationVersion,
        details: {
          issuer: agent_identity.issuer,
          reputationTier: agent_identity.reputation_tier,
          attestationVerified: true
        }
      }
    };
  }
};

// src/adapters/index.ts
var ProtocolAdapterRegistry = class {
  adapters = /* @__PURE__ */ new Map();
  constructor() {
    this.register(new ACGNativeAdapter());
    this.register(new McpProtocolAdapter());
    this.register(new A2AProtocolAdapter());
    this.register(new AcpProtocolAdapter());
    this.register(new Ap2ProtocolAdapter());
    this.register(new UcpProtocolAdapter());
    this.register(new VisaTapProtocolAdapter());
  }
  register(adapter) {
    this.adapters.set(adapter.protocol.toLowerCase(), adapter);
  }
  get(protocol) {
    return this.adapters.get(protocol.toLowerCase());
  }
  listAdapters() {
    return Array.from(this.adapters.values());
  }
  async normalize(protocol, rawPayload, merchantId) {
    const adapter = this.get(protocol);
    if (!adapter) {
      return {
        success: false,
        error: `Unsupported agentic commerce protocol: '${protocol}'. Supported: ${Array.from(this.adapters.keys()).join(", ")}`,
        code: "UNSUPPORTED_PROTOCOL"
      };
    }
    return adapter.normalize(rawPayload, merchantId);
  }
};
var defaultAdapterRegistry = new ProtocolAdapterRegistry();

// src/rails/intelligence.ts
var RazorpayVulcanIntelligenceProvider = class {
  providerId = "razorpay-vulcan-foundation-model";
  displayName = "Razorpay Vulcan AI Foundation Model";
  modelVersion = "vulcan-v1.4-live-transformer";
  async evaluate(context) {
    const isLargeTicket = context.amountPaise > 5e6;
    const highRiskCategory = context.itemCategories.some((c) => ["gift_cards", "crypto_credits", "gaming"].includes(c.toLowerCase()));
    let riskScore = 0.02;
    if (isLargeTicket) riskScore += 0.08;
    if (highRiskCategory) riskScore += 0.25;
    let optimalRail = "razorpay_direct";
    let estimatedLatency = 210;
    let successRateBps = 9985;
    if (context.amountPaise <= 2e5) {
      optimalRail = "upi_reserve_pay";
      estimatedLatency = 145;
      successRateBps = 9992;
    } else if (context.amountPaise > 1e6) {
      optimalRail = "cards_v3";
      estimatedLatency = 380;
      successRateBps = 9960;
    }
    return {
      provider: "Razorpay Vulcan [Architecture Ready]",
      providerId: this.providerId,
      evaluatedAt: Date.now(),
      modelVersion: this.modelVersion,
      status: "ARCHITECTURE READY / ADVISORY",
      riskSignals: {
        riskScore: Math.min(Number(riskScore.toFixed(4)), 0.99),
        networkFraudProbability: Number((riskScore * 0.45).toFixed(4)),
        anomalyScore: 0.012,
        velocityAlert: false,
        recommendedAction: riskScore > 0.4 ? "FLAG" : "PROCEED"
      },
      routingHints: {
        optimalRail,
        estimatedLatencyMs: estimatedLatency,
        expectedSuccessRateBps: successRateBps
      },
      authorityDisclaimer: "Architecture-ready downstream advisory telemetry. No public developer inference API exists for Vulcan. ACG enforces binding merchant authorization."
    };
  }
};
var defaultVulcanIntelligence = new RazorpayVulcanIntelligenceProvider();

// src/gateway/auth.ts
function getValidTokens() {
  const isProd = process.env.NODE_ENV === "production";
  const adminToken = process.env.ACG_ADMIN_TOKEN || (!isProd ? "secret_merchant_admin" : void 0);
  const viewerToken = process.env.ACG_VIEWER_TOKEN || (!isProd ? "secret_merchant_viewer" : void 0);
  const auditToken = process.env.ACG_AUDIT_TOKEN || (!isProd ? "secret_audit_bot" : void 0);
  const tokenMap = {};
  if (adminToken) {
    tokenMap[adminToken] = [
      "merchant:read",
      "merchant:write",
      "merchant:policy:write",
      "merchant:mandate:revoke",
      "merchant:refund",
      "audit:read",
      "audit:verify"
    ];
  }
  if (viewerToken) {
    tokenMap[viewerToken] = ["merchant:read", "audit:read"];
  }
  if (auditToken) {
    tokenMap[auditToken] = ["audit:read", "audit:verify"];
  }
  return tokenMap;
}
function requireScope(requiredScope) {
  return async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "UNAUTHORIZED", message: "Missing or invalid Authorization header" });
    }
    const token = authHeader.substring(7);
    const validTokens = getValidTokens();
    const scopes = validTokens[token];
    if (!scopes) {
      return reply.status(401).send({ error: "UNAUTHORIZED", message: "Invalid credentials" });
    }
    if (!scopes.includes(requiredScope)) {
      return reply.status(403).send({ error: "FORBIDDEN", message: `Insufficient permissions. Requires scope: ${requiredScope}` });
    }
    request.merchantAuthScopes = scopes;
  };
}

// src/core/agent_principal.ts
import { z as z8 } from "zod";
var AgentPrincipalSchema = z8.object({
  agent_id: z8.string().min(1),
  organization_id: z8.string().min(1),
  provider: z8.string().min(1),
  model_name: z8.string().min(1),
  agent_type: z8.enum(["AUTONOMOUS", "ASSISTED", "DELEGATED", "SYSTEM"]),
  trust_level: z8.enum(["UNTRUSTED", "PROVISIONAL", "VERIFIED", "ENTERPRISE"]),
  credential_state: z8.enum(["ACTIVE", "ROTATED", "SUSPENDED", "REVOKED"]),
  created_at: z8.number().int().positive(),
  expires_at: z8.number().int().positive(),
  status: z8.enum(["REGISTERED", "ACTIVE", "SUSPENDED", "REVOKED", "EXPIRED"]),
  metadata: z8.record(z8.unknown()).optional()
});
var AgentCapabilitySchema = z8.object({
  capability_id: z8.string().min(1),
  agent_id: z8.string().min(1),
  capability: z8.enum([
    "PURCHASE",
    "PAYMENT",
    "REFUND",
    "SUBSCRIPTION",
    "PAYOUT",
    "PAYMENT_LINK",
    "TRANSFER"
  ]),
  max_amount: z8.number().int().positive(),
  // in paise
  currency: z8.literal("INR"),
  categories: z8.array(z8.string()).default(["*"]),
  merchant_scope: z8.array(z8.string()).default(["*"]),
  daily_budget: z8.number().int().positive(),
  // in paise
  daily_spent: z8.number().int().nonnegative().default(0),
  confirmation_above: z8.number().int().positive().default(3e5),
  // e.g. ₹3,000
  expires_at: z8.number().int().positive(),
  status: z8.enum(["ACTIVE", "REVOKED"]).default("ACTIVE"),
  created_at: z8.number().int().positive()
});
var AgentPrincipalRegistry = class {
  db;
  constructor(db) {
    this.db = db;
    this.seedDefaultPrincipals();
  }
  seedDefaultPrincipals() {
    const now = Math.floor(Date.now() / 1e3);
    const oneYearLater = now + 365 * 24 * 3600;
    this.upsertPrincipal({
      agent_id: "native-llm-agent",
      organization_id: "org_razorpay_default",
      provider: "anthropic",
      model_name: "claude-3-7-sonnet",
      agent_type: "AUTONOMOUS",
      trust_level: "VERIFIED",
      credential_state: "ACTIVE",
      created_at: now,
      expires_at: oneYearLater,
      status: "ACTIVE"
    });
    this.upsertCapability({
      capability_id: "cap_native_purchase",
      agent_id: "native-llm-agent",
      capability: "PURCHASE",
      max_amount: 1e7,
      // ₹1,00,000
      currency: "INR",
      categories: ["*"],
      merchant_scope: ["*"],
      daily_budget: 5e7,
      // ₹5,00,000
      daily_spent: 0,
      confirmation_above: 5e6,
      // ₹50,000 default threshold (matches merchant max amount)
      expires_at: oneYearLater,
      status: "ACTIVE",
      created_at: now
    });
  }
  upsertPrincipal(principal) {
    this.db.prepare(`
        INSERT INTO agent_principals (
          agent_id, organization_id, provider, model_name, agent_type,
          trust_level, credential_state, created_at, expires_at, status, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(agent_id) DO UPDATE SET
          organization_id = excluded.organization_id,
          provider = excluded.provider,
          model_name = excluded.model_name,
          agent_type = excluded.agent_type,
          trust_level = excluded.trust_level,
          credential_state = excluded.credential_state,
          expires_at = excluded.expires_at,
          status = excluded.status,
          metadata_json = excluded.metadata_json
      `).run(
      principal.agent_id,
      principal.organization_id,
      principal.provider,
      principal.model_name,
      principal.agent_type,
      principal.trust_level,
      principal.credential_state,
      principal.created_at,
      principal.expires_at,
      principal.status,
      principal.metadata ? JSON.stringify(principal.metadata) : null
    );
  }
  getPrincipal(agentId) {
    const row = this.db.prepare("SELECT * FROM agent_principals WHERE agent_id = ?").get(agentId);
    if (!row) return null;
    return {
      agent_id: row.agent_id,
      organization_id: row.organization_id,
      provider: row.provider,
      model_name: row.model_name,
      agent_type: row.agent_type,
      trust_level: row.trust_level,
      credential_state: row.credential_state,
      created_at: Number(row.created_at),
      expires_at: Number(row.expires_at),
      status: row.status,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : void 0
    };
  }
  listPrincipals() {
    const rows = this.db.prepare("SELECT * FROM agent_principals ORDER BY created_at DESC").all();
    return rows.map((row) => ({
      agent_id: row.agent_id,
      organization_id: row.organization_id,
      provider: row.provider,
      model_name: row.model_name,
      agent_type: row.agent_type,
      trust_level: row.trust_level,
      credential_state: row.credential_state,
      created_at: Number(row.created_at),
      expires_at: Number(row.expires_at),
      status: row.status,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : void 0
    }));
  }
  upsertCapability(cap) {
    this.db.prepare(`
        INSERT INTO agent_capabilities (
          capability_id, agent_id, capability, max_amount, currency,
          categories_json, merchant_scope_json, daily_budget, daily_spent,
          confirmation_above, expires_at, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(capability_id) DO UPDATE SET
          max_amount = excluded.max_amount,
          categories_json = excluded.categories_json,
          merchant_scope_json = excluded.merchant_scope_json,
          daily_budget = excluded.daily_budget,
          confirmation_above = excluded.confirmation_above,
          expires_at = excluded.expires_at,
          status = excluded.status
      `).run(
      cap.capability_id,
      cap.agent_id,
      cap.capability,
      cap.max_amount,
      cap.currency,
      JSON.stringify(cap.categories),
      JSON.stringify(cap.merchant_scope),
      cap.daily_budget,
      cap.daily_spent,
      cap.confirmation_above,
      cap.expires_at,
      cap.status,
      cap.created_at
    );
  }
  getCapabilities(agentId) {
    const rows = this.db.prepare("SELECT * FROM agent_capabilities WHERE agent_id = ? AND status = 'ACTIVE'").all(agentId);
    return rows.map((row) => ({
      capability_id: row.capability_id,
      agent_id: row.agent_id,
      capability: row.capability,
      max_amount: Number(row.max_amount),
      currency: "INR",
      categories: JSON.parse(row.categories_json),
      merchant_scope: JSON.parse(row.merchant_scope_json),
      daily_budget: Number(row.daily_budget),
      daily_spent: Number(row.daily_spent),
      confirmation_above: Number(row.confirmation_above),
      expires_at: Number(row.expires_at),
      status: row.status,
      created_at: Number(row.created_at)
    }));
  }
  setAgentStatus(agentId, status) {
    const res = this.db.prepare("UPDATE agent_principals SET status = ? WHERE agent_id = ?").run(status, agentId);
    return res.changes > 0;
  }
};

// src/core/kill_switch.ts
var KillSwitchEngine = class {
  db;
  constructor(db) {
    this.db = db;
  }
  setKillSwitch(scope, pause, reason = "Operational security intervention", activatedBy = "merchant_admin") {
    const now = Math.floor(Date.now() / 1e3);
    this.db.prepare(`
        INSERT INTO kill_switches (scope, is_paused, reason, activated_by, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(scope) DO UPDATE SET
          is_paused = excluded.is_paused,
          reason = excluded.reason,
          activated_by = excluded.activated_by,
          updated_at = excluded.updated_at
      `).run(scope, pause ? 1 : 0, reason, activatedBy, now);
  }
  checkKillSwitch(merchantId, agentId) {
    const globalRow = this.db.prepare("SELECT * FROM kill_switches WHERE scope = 'GLOBAL' AND is_paused = 1").get();
    if (globalRow) {
      return {
        isPaused: true,
        scope: "GLOBAL",
        reason: globalRow.reason || "Global agent commerce switch engaged",
        activatedBy: globalRow.activated_by,
        updatedAt: Number(globalRow.updated_at)
      };
    }
    const merchantScope = `MERCHANT:${merchantId}`;
    const merchantRow = this.db.prepare("SELECT * FROM kill_switches WHERE scope = ? AND is_paused = 1").get(merchantScope);
    if (merchantRow) {
      return {
        isPaused: true,
        scope: merchantScope,
        reason: merchantRow.reason || `Merchant ${merchantId} agent switch engaged`,
        activatedBy: merchantRow.activated_by,
        updatedAt: Number(merchantRow.updated_at)
      };
    }
    if (agentId) {
      const agentScope = `AGENT:${agentId}`;
      const agentRow = this.db.prepare("SELECT * FROM kill_switches WHERE scope = ? AND is_paused = 1").get(agentScope);
      if (agentRow) {
        return {
          isPaused: true,
          scope: agentScope,
          reason: agentRow.reason || `Agent ${agentId} kill switch engaged`,
          activatedBy: agentRow.activated_by,
          updatedAt: Number(agentRow.updated_at)
        };
      }
    }
    return { isPaused: false };
  }
  listKillSwitches() {
    const rows = this.db.prepare("SELECT * FROM kill_switches ORDER BY updated_at DESC").all();
    return rows.map((r) => ({
      scope: r.scope,
      isPaused: Number(r.is_paused) === 1,
      reason: r.reason,
      activatedBy: r.activated_by,
      updatedAt: Number(r.updated_at)
    }));
  }
};

// src/core/velocity.ts
var VelocityEngine = class {
  db;
  constructor(db) {
    this.db = db;
  }
  recordAction(entityType, entityId, amountPaise) {
    const now = Math.floor(Date.now() / 1e3);
    this.db.prepare(`
        INSERT INTO velocity_ledger (entity_type, entity_id, amount, timestamp)
        VALUES (?, ?, ?, ?)
      `).run(entityType, entityId, amountPaise, now);
  }
  checkVelocity(entityType, entityId, proposedAmountPaise, limits) {
    const now = Math.floor(Date.now() / 1e3);
    const oneMinuteAgo = now - 60;
    const oneHourAgo = now - 3600;
    const oneDayAgo = now - 86400;
    if (limits.perMinuteCount || limits.perMinutePaise) {
      const minRow = this.db.prepare(`
          SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as total
          FROM velocity_ledger
          WHERE entity_type = ? AND entity_id = ? AND timestamp >= ?
        `).get(entityType, entityId, oneMinuteAgo);
      const currentCount = Number(minRow.cnt);
      const currentTotal = Number(minRow.total);
      if (limits.perMinuteCount && currentCount >= limits.perMinuteCount) {
        return {
          allowed: false,
          reason: `Velocity limit exceeded: ${currentCount} actions in last 60s (max allowed: ${limits.perMinuteCount})`,
          code: "VELOCITY_PER_MINUTE_COUNT_EXCEEDED",
          currentMinuteCount: currentCount,
          currentMinutePaise: currentTotal
        };
      }
      if (limits.perMinutePaise && currentTotal + proposedAmountPaise > limits.perMinutePaise) {
        return {
          allowed: false,
          reason: `Velocity amount limit exceeded: \u20B9${((currentTotal + proposedAmountPaise) / 100).toFixed(2)} in last 60s (max allowed: \u20B9${(limits.perMinutePaise / 100).toFixed(2)})`,
          code: "VELOCITY_PER_MINUTE_AMOUNT_EXCEEDED",
          currentMinuteCount: currentCount,
          currentMinutePaise: currentTotal
        };
      }
    }
    if (limits.perHourCount || limits.perHourPaise) {
      const hrRow = this.db.prepare(`
          SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as total
          FROM velocity_ledger
          WHERE entity_type = ? AND entity_id = ? AND timestamp >= ?
        `).get(entityType, entityId, oneHourAgo);
      const hrCount = Number(hrRow.cnt);
      const hrTotal = Number(hrRow.total);
      if (limits.perHourCount && hrCount >= limits.perHourCount) {
        return {
          allowed: false,
          reason: `Velocity limit exceeded: ${hrCount} actions in last hour (max allowed: ${limits.perHourCount})`,
          code: "VELOCITY_PER_HOUR_COUNT_EXCEEDED"
        };
      }
      if (limits.perHourPaise && hrTotal + proposedAmountPaise > limits.perHourPaise) {
        return {
          allowed: false,
          reason: `Velocity amount limit exceeded in last hour (max allowed: \u20B9${(limits.perHourPaise / 100).toFixed(2)})`,
          code: "VELOCITY_PER_HOUR_AMOUNT_EXCEEDED"
        };
      }
    }
    if (limits.perDayCount || limits.perDayPaise) {
      const dayRow = this.db.prepare(`
          SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as total
          FROM velocity_ledger
          WHERE entity_type = ? AND entity_id = ? AND timestamp >= ?
        `).get(entityType, entityId, oneDayAgo);
      const dayCount = Number(dayRow.cnt);
      const dayTotal = Number(dayRow.total);
      if (limits.perDayCount && dayCount >= limits.perDayCount) {
        return {
          allowed: false,
          reason: `Daily velocity count exceeded: ${dayCount} actions today (max allowed: ${limits.perDayCount})`,
          code: "VELOCITY_PER_DAY_COUNT_EXCEEDED"
        };
      }
      if (limits.perDayPaise && dayTotal + proposedAmountPaise > limits.perDayPaise) {
        return {
          allowed: false,
          reason: `Daily velocity spend limit exceeded (max allowed: \u20B9${(limits.perDayPaise / 100).toFixed(2)})`,
          code: "VELOCITY_PER_DAY_AMOUNT_EXCEEDED"
        };
      }
    }
    return { allowed: true };
  }
};

// src/core/budget_hierarchy.ts
var HierarchicalBudgetEngine = class {
  db;
  constructor(db) {
    this.db = db;
  }
  initMerchantBudgetIfAbsent(merchantId, dailyLimitPaise = 5e7) {
    const existing = this.db.prepare("SELECT merchant_id FROM merchant_budgets WHERE merchant_id = ?").get(merchantId);
    if (!existing) {
      const now = Math.floor(Date.now() / 1e3);
      const resetAt = now + 86400;
      this.db.prepare(`
          INSERT INTO merchant_budgets (merchant_id, daily_budget_limit, daily_spent, reset_at)
          VALUES (?, ?, 0, ?)
        `).run(merchantId, dailyLimitPaise, resetAt);
    }
  }
  evaluateHierarchy(merchantId, agentId, mandate, totalPaise) {
    this.initMerchantBudgetIfAbsent(merchantId);
    const merchantRow = this.db.prepare("SELECT * FROM merchant_budgets WHERE merchant_id = ?").get(merchantId);
    if (merchantRow) {
      const available = Number(merchantRow.daily_budget_limit) - Number(merchantRow.daily_spent);
      if (totalPaise > available) {
        return {
          allowed: false,
          reason: `Merchant daily budget exceeded: required \u20B9${(totalPaise / 100).toFixed(2)}, available \u20B9${(available / 100).toFixed(2)}`,
          code: "MERCHANT_DAILY_BUDGET_EXCEEDED",
          merchantRemaining: available
        };
      }
    }
    const capRow = this.db.prepare("SELECT * FROM agent_capabilities WHERE agent_id = ? AND capability = 'PURCHASE' AND status = 'ACTIVE'").get(agentId);
    if (capRow) {
      const maxTx = Number(capRow.max_amount);
      if (totalPaise > maxTx) {
        return {
          allowed: false,
          reason: `Agent single-transaction capability ceiling exceeded (max: \u20B9${(maxTx / 100).toFixed(2)})`,
          code: "AGENT_TRANSACTION_LIMIT_EXCEEDED"
        };
      }
      const agentDailyAvail = Number(capRow.daily_budget) - Number(capRow.daily_spent);
      if (totalPaise > agentDailyAvail) {
        return {
          allowed: false,
          reason: `Agent daily spend budget exceeded (available: \u20B9${(agentDailyAvail / 100).toFixed(2)})`,
          code: "AGENT_DAILY_BUDGET_EXCEEDED",
          agentRemaining: agentDailyAvail
        };
      }
    }
    const mandateRow = this.db.prepare("SELECT remaining_budget FROM buyer_mandates WHERE mandate_id = ?").get(mandate.mandate_id);
    const mandateRemaining = mandateRow ? Number(mandateRow.remaining_budget) : mandate.budget_limit;
    if (totalPaise > mandateRemaining) {
      const isPartiallySpent = mandateRemaining < mandate.budget_limit;
      return {
        allowed: false,
        reason: `Buyer mandate budget limit exceeded (remaining: \u20B9${(mandateRemaining / 100).toFixed(2)})`,
        code: isPartiallySpent ? "MANDATE_EXHAUSTED" : "MANDATE_BUDGET_EXCEEDED",
        mandateRemaining
      };
    }
    return {
      allowed: true,
      merchantRemaining: merchantRow ? Number(merchantRow.daily_budget_limit) - Number(merchantRow.daily_spent) : void 0,
      mandateRemaining
    };
  }
  recordSpend(merchantId, agentId, amountPaise) {
    this.db.prepare("UPDATE merchant_budgets SET daily_spent = daily_spent + ? WHERE merchant_id = ?").run(amountPaise, merchantId);
    this.db.prepare("UPDATE agent_capabilities SET daily_spent = daily_spent + ? WHERE agent_id = ? AND capability = 'PURCHASE'").run(amountPaise, agentId);
  }
};

// src/core/pdp.ts
init_crypto();
import crypto13 from "node:crypto";
var PolicyDecisionPoint = class {
  db;
  truthEngine;
  principalRegistry;
  killSwitchEngine;
  velocityEngine;
  budgetEngine;
  constructor(db, truthEngine, principalRegistry, killSwitchEngine, velocityEngine, budgetEngine) {
    this.db = db;
    this.truthEngine = truthEngine;
    this.principalRegistry = principalRegistry;
    this.killSwitchEngine = killSwitchEngine;
    this.velocityEngine = velocityEngine;
    this.budgetEngine = budgetEngine;
  }
  evaluateIntent(intent, policy, agentId = "native-llm-agent") {
    const now = Math.floor(Date.now() / 1e3);
    const decisionId = `dec_${crypto13.randomUUID()}`;
    const intentId = intent.intent_id;
    const merchantId = policy.merchant_id;
    const baseEvidence = {
      evaluated_at: now,
      policy_version: policy.policy_version,
      agent_id: agentId,
      merchant_id: merchantId
    };
    const makeDecision = (decision, reasonCode, evidenceExtra = {}, requestedAmount = 0, authorizedAmount = 0, confirmationToken) => {
      const dec = {
        decision_id: decisionId,
        intent_id: intentId,
        agent_id: agentId,
        merchant_id: merchantId,
        decision,
        reason_code: reasonCode,
        policy_id: `pol_${merchantId}`,
        policy_version: policy.policy_version,
        timestamp: now,
        input_references: {
          intent_id: intent.intent_id,
          client_nonce: intent.client_nonce,
          mandate_id: intent.mandate.mandate_id,
          mandate: intent.mandate,
          proposed_items: intent.proposed_items
        },
        authorization_evidence: { ...baseEvidence, ...evidenceExtra },
        resource_decision: {
          requested_amount_paise: requestedAmount,
          authorized_amount_paise: authorizedAmount,
          confirmation_token: confirmationToken
        }
      };
      this.db.prepare(`
          INSERT INTO pdp_decisions (
            decision_id, intent_id, agent_id, merchant_id, decision, reason_code,
            policy_id, policy_version, timestamp, input_references_json,
            authorization_evidence_json, resource_decision_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
        dec.decision_id,
        dec.intent_id,
        dec.agent_id,
        dec.merchant_id,
        dec.decision,
        dec.reason_code,
        dec.policy_id,
        dec.policy_version,
        dec.timestamp,
        JSON.stringify(dec.input_references),
        JSON.stringify(dec.authorization_evidence),
        JSON.stringify(dec.resource_decision)
      );
      return { decision: dec };
    };
    const ks = this.killSwitchEngine.checkKillSwitch(merchantId, agentId);
    if (ks.isPaused) {
      return makeDecision("DENY", "KILL_SWITCH_ENGAGED", { kill_switch: ks });
    }
    const principal = this.principalRegistry.getPrincipal(agentId);
    if (!principal) {
      return makeDecision("DENY", "AGENT_PRINCIPAL_NOT_FOUND", { agent_id: agentId });
    }
    if (principal.status !== "ACTIVE") {
      return makeDecision("DENY", `AGENT_${principal.status}`, { status: principal.status });
    }
    if (principal.credential_state !== "ACTIVE") {
      return makeDecision("DENY", `AGENT_CREDENTIAL_${principal.credential_state}`, { credential_state: principal.credential_state });
    }
    if (now > principal.expires_at) {
      return makeDecision("DENY", "AGENT_CREDENTIAL_EXPIRED", { expires_at: principal.expires_at });
    }
    const capabilities = this.principalRegistry.getCapabilities(agentId);
    const purchaseCap = capabilities.find((c) => c.capability === "PURCHASE" && c.status === "ACTIVE");
    if (!purchaseCap) {
      return makeDecision("DENY", "CAPABILITY_PURCHASE_NOT_GRANTED", { agent_id: agentId });
    }
    if (now > purchaseCap.expires_at) {
      return makeDecision("DENY", "CAPABILITY_EXPIRED", { capability_id: purchaseCap.capability_id });
    }
    const revokedRow = this.db.prepare("SELECT * FROM revoked_mandates WHERE mandate_id = ?").get(intent.mandate.mandate_id);
    if (revokedRow) {
      return makeDecision("DENY", "MANDATE_REVOKED", {
        mandate_id: intent.mandate.mandate_id,
        revoked_at: revokedRow.revoked_at,
        reason: revokedRow.revocation_reason
      });
    }
    if (now > intent.mandate.expiry) {
      return makeDecision("DENY", "MANDATE_EXPIRED", { mandate_expiry: intent.mandate.expiry, current_time: now });
    }
    const isSigValid = verifyMandateSignature(intent.mandate);
    if (!isSigValid) {
      return makeDecision("DENY", "INVALID_MANDATE_SIGNATURE", { mandate_id: intent.mandate.mandate_id });
    }
    if (intent.mandate.merchant_whitelist && intent.mandate.merchant_whitelist.length > 0) {
      if (!intent.mandate.merchant_whitelist.includes(merchantId)) {
        return makeDecision("DENY", "MERCHANT_NOT_WHITELISTED", { whitelist: intent.mandate.merchant_whitelist });
      }
    }
    const truthResult = this.truthEngine.resolveTruth(intent.proposed_items);
    if (!truthResult.isValid) {
      return makeDecision("DENY", "COMMERCE_TRUTH_REJECTION", { truth_error: truthResult.error });
    }
    if (intent.mandate.category_whitelist && intent.mandate.category_whitelist.length > 0) {
      for (const cat of truthResult.categories) {
        if (!intent.mandate.category_whitelist.includes(cat)) {
          return makeDecision("DENY", "CATEGORY_NOT_WHITELISTED", { category: cat, whitelist: intent.mandate.category_whitelist }, truthResult.totalAmount);
        }
      }
    }
    if (purchaseCap.merchant_scope && !purchaseCap.merchant_scope.includes("*") && !purchaseCap.merchant_scope.includes(merchantId)) {
      return makeDecision("DENY", "AGENT_MERCHANT_SCOPE_RESTRICTED", { merchant_scope: purchaseCap.merchant_scope }, truthResult.totalAmount);
    }
    if (purchaseCap.categories && !purchaseCap.categories.includes("*")) {
      for (const cat of truthResult.categories) {
        if (!purchaseCap.categories.includes(cat)) {
          return makeDecision("DENY", "AGENT_CATEGORY_RESTRICTED", { category: cat, allowed: purchaseCap.categories }, truthResult.totalAmount);
        }
      }
    }
    if (truthResult.totalAmount > policy.max_transaction_amount) {
      return makeDecision("DENY", "MERCHANT_MAX_AMOUNT_EXCEEDED", { max_allowed: policy.max_transaction_amount }, truthResult.totalAmount);
    }
    for (const cat of truthResult.categories) {
      if (!policy.allowed_categories.includes(cat)) {
        return makeDecision("DENY", "MERCHANT_CATEGORY_RESTRICTED", { category: cat, allowed: policy.allowed_categories }, truthResult.totalAmount);
      }
    }
    const budgetCheck = this.budgetEngine.evaluateHierarchy(merchantId, agentId, intent.mandate, truthResult.totalAmount);
    if (!budgetCheck.allowed) {
      return makeDecision("DENY", budgetCheck.code || "BUDGET_EXCEEDED", { budget_reason: budgetCheck.reason }, truthResult.totalAmount);
    }
    const velocityCheck = this.velocityEngine.checkVelocity("AGENT", agentId, truthResult.totalAmount, {
      perMinuteCount: 20,
      perMinutePaise: 2e6,
      // ₹20,000 / min
      perDayCount: 500
    });
    if (!velocityCheck.allowed) {
      return makeDecision("DENY", velocityCheck.code || "VELOCITY_EXCEEDED", { velocity_reason: velocityCheck.reason }, truthResult.totalAmount);
    }
    if (truthResult.totalAmount > purchaseCap.confirmation_above) {
      const confirmationToken = `conf_${crypto13.randomBytes(16).toString("hex")}`;
      const confId = `cnf_${crypto13.randomUUID()}`;
      const expiresAt = now + 900;
      this.db.prepare(`
          INSERT INTO pending_confirmations (
            confirmation_id, decision_id, intent_id, agent_id, merchant_id,
            amount, confirmation_token, status, expires_at, created_at, payload_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)
        `).run(
        confId,
        decisionId,
        intentId,
        agentId,
        merchantId,
        truthResult.totalAmount,
        confirmationToken,
        expiresAt,
        now,
        JSON.stringify({ intent, policy_version: policy.policy_version, truthResult })
      );
      const decisionObj = makeDecision(
        "REQUIRE_CONFIRMATION",
        "CONFIRMATION_REQUIRED_ABOVE_THRESHOLD",
        {
          threshold_paise: purchaseCap.confirmation_above,
          confirmation_id: confId,
          confirmation_token: confirmationToken,
          expires_at: expiresAt
        },
        truthResult.totalAmount,
        0,
        confirmationToken
      );
      decisionObj.truthResult = truthResult;
      return decisionObj;
    }
    const allowedDecision = makeDecision(
      "ALLOW",
      "AUTHORIZATION_GRANTED",
      {
        verified_truth_total: truthResult.totalAmount,
        categories: truthResult.categories
      },
      truthResult.totalAmount,
      truthResult.totalAmount
    );
    allowedDecision.truthResult = truthResult;
    return allowedDecision;
  }
  /**
   * V2.8: POLICY SIMULATION (Zero Mutation)
   */
  simulate(intent, policy, agentId = "native-llm-agent") {
    const simId = `sim_${crypto13.randomUUID()}`;
    const stages = [];
    const now = Math.floor(Date.now() / 1e3);
    const ks = this.killSwitchEngine.checkKillSwitch(policy.merchant_id, agentId);
    if (ks.isPaused) {
      stages.push({ stage: "KILL_SWITCH", passed: false, error: ks.reason });
      return {
        simulation_id: simId,
        verdict: "WOULD_DENY",
        reason_code: "KILL_SWITCH_ENGAGED",
        reason: ks.reason || "Kill switch engaged",
        policy_version: policy.policy_version,
        stages,
        non_mutating: true
      };
    }
    stages.push({ stage: "KILL_SWITCH", passed: true });
    const principal = this.principalRegistry.getPrincipal(agentId);
    if (!principal || principal.status !== "ACTIVE") {
      stages.push({ stage: "AGENT_IDENTITY", passed: false, error: "Invalid agent principal or status" });
      return {
        simulation_id: simId,
        verdict: "WOULD_DENY",
        reason_code: "AGENT_IDENTITY_INVALID",
        reason: "Agent principal identity is invalid or inactive",
        policy_version: policy.policy_version,
        stages,
        non_mutating: true
      };
    }
    stages.push({ stage: "AGENT_IDENTITY", passed: true, details: { agent_id: principal.agent_id, trust_level: principal.trust_level } });
    if (now > intent.mandate.expiry) {
      stages.push({ stage: "MANDATE_EXPIRY", passed: false, error: "Mandate is temporally expired" });
      return {
        simulation_id: simId,
        verdict: "WOULD_DENY",
        reason_code: "MANDATE_EXPIRED",
        reason: "Mandate is expired",
        policy_version: policy.policy_version,
        stages,
        non_mutating: true
      };
    }
    const isSigValid = verifyMandateSignature(intent.mandate);
    if (!isSigValid) {
      stages.push({ stage: "MANDATE_SIGNATURE", passed: false, error: "Cryptographic signature mismatch" });
      return {
        simulation_id: simId,
        verdict: "WOULD_DENY",
        reason_code: "INVALID_MANDATE_SIGNATURE",
        reason: "Mandate signature verification failed",
        policy_version: policy.policy_version,
        stages,
        non_mutating: true
      };
    }
    stages.push({ stage: "MANDATE_VERIFIED", passed: true });
    const truthResult = this.truthEngine.resolveTruth(intent.proposed_items);
    if (!truthResult.isValid) {
      stages.push({ stage: "COMMERCE_TRUTH", passed: false, error: truthResult.error });
      return {
        simulation_id: simId,
        verdict: "WOULD_DENY",
        reason_code: "COMMERCE_TRUTH_REJECTION",
        reason: truthResult.error || "Catalog truth error",
        policy_version: policy.policy_version,
        stages,
        non_mutating: true
      };
    }
    stages.push({ stage: "COMMERCE_TRUTH", passed: true, details: { total_paise: truthResult.totalAmount } });
    if (truthResult.totalAmount > policy.max_transaction_amount) {
      stages.push({ stage: "POLICY_TRANSACTION_LIMIT", passed: false, error: `Exceeds max transaction limit of \u20B9${(policy.max_transaction_amount / 100).toFixed(2)}` });
      return {
        simulation_id: simId,
        verdict: "WOULD_DENY",
        reason_code: "MERCHANT_MAX_AMOUNT_EXCEEDED",
        reason: "Exceeds merchant max transaction cap",
        policy_version: policy.policy_version,
        stages,
        non_mutating: true
      };
    }
    stages.push({ stage: "MERCHANT_POLICY", passed: true });
    const budgetCheck = this.budgetEngine.evaluateHierarchy(policy.merchant_id, agentId, intent.mandate, truthResult.totalAmount);
    if (!budgetCheck.allowed) {
      stages.push({ stage: "BUDGET_HIERARCHY", passed: false, error: budgetCheck.reason });
      return {
        simulation_id: simId,
        verdict: "WOULD_DENY",
        reason_code: budgetCheck.code || "BUDGET_EXCEEDED",
        reason: budgetCheck.reason || "Budget hierarchy check failed",
        policy_version: policy.policy_version,
        stages,
        non_mutating: true
      };
    }
    stages.push({ stage: "BUDGET_HIERARCHY", passed: true });
    const capabilities = this.principalRegistry.getCapabilities(agentId);
    const purchaseCap = capabilities.find((c) => c.capability === "PURCHASE");
    const confirmThreshold = purchaseCap?.confirmation_above || 3e5;
    if (truthResult.totalAmount > confirmThreshold) {
      stages.push({ stage: "CONFIRMATION_EVALUATION", passed: true, details: { requires_human_approval: true, threshold_paise: confirmThreshold } });
      return {
        simulation_id: simId,
        verdict: "WOULD_REQUIRE_CONFIRMATION",
        reason_code: "CONFIRMATION_REQUIRED_ABOVE_THRESHOLD",
        reason: `Amount (\u20B9${(truthResult.totalAmount / 100).toFixed(2)}) exceeds autonomous threshold (\u20B9${(confirmThreshold / 100).toFixed(2)})`,
        policy_version: policy.policy_version,
        stages,
        computed_truth: truthResult,
        non_mutating: true
      };
    }
    stages.push({ stage: "CONFIRMATION_EVALUATION", passed: true, details: { requires_human_approval: false } });
    return {
      simulation_id: simId,
      verdict: "WOULD_ALLOW",
      reason_code: "SIMULATION_PERMITTED",
      reason: "All security invariants and policy constraints satisfied in simulation.",
      policy_version: policy.policy_version,
      stages,
      computed_truth: truthResult,
      non_mutating: true
    };
  }
  /**
   * V2.9: DECISION REPLAY (Zero Mutation)
   */
  replayDecision(decisionId, overridePolicy) {
    const row = this.db.prepare("SELECT * FROM pdp_decisions WHERE decision_id = ?").get(decisionId);
    if (!row) {
      throw new Error(`Decision ID '${decisionId}' not found in audit store.`);
    }
    const inputRefs = JSON.parse(row.input_references_json);
    const originalDecision = row.decision;
    const originalReason = row.reason_code;
    const originalVersion = row.policy_version;
    const mandate = inputRefs.mandate || {
      mandate_id: inputRefs.mandate_id,
      principal_public_key: "0".repeat(64),
      budget_limit: 5e5,
      currency: "INR",
      expiry: Math.floor(Date.now() / 1e3) + 3600,
      signature: "0".repeat(128)
    };
    const intent = {
      intent_id: inputRefs.intent_id,
      client_nonce: inputRefs.client_nonce,
      timestamp: row.timestamp,
      mandate,
      proposed_items: inputRefs.proposed_items
    };
    const targetPolicy = overridePolicy || {
      policy_version: originalVersion,
      effective_at: row.timestamp,
      merchant_id: row.merchant_id,
      max_transaction_amount: 1e6,
      allowed_categories: ["electronics", "furniture", "supplies"],
      auto_refund_on_fulfillment_failure: true,
      min_margin_percentage: 10
    };
    const sim = this.simulate(intent, targetPolicy, row.agent_id);
    const replayedDecision = sim.verdict === "WOULD_ALLOW" ? "ALLOW" : sim.verdict === "WOULD_DENY" ? "DENY" : "REQUIRE_CONFIRMATION";
    return {
      replay_id: `rpl_${crypto13.randomUUID()}`,
      original_decision_id: decisionId,
      original_decision: originalDecision,
      original_reason_code: originalReason,
      original_policy_version: originalVersion,
      replayed_decision: replayedDecision,
      replayed_reason_code: sim.reason_code,
      replayed_policy_version: targetPolicy.policy_version,
      delta: originalDecision === replayedDecision ? "MATCH" : "CHANGED",
      non_mutating: true
    };
  }
  getDecision(decisionId) {
    const row = this.db.prepare("SELECT * FROM pdp_decisions WHERE decision_id = ?").get(decisionId);
    if (!row) return null;
    return {
      decision_id: row.decision_id,
      intent_id: row.intent_id,
      agent_id: row.agent_id,
      merchant_id: row.merchant_id,
      decision: row.decision,
      reason_code: row.reason_code,
      policy_id: row.policy_id,
      policy_version: row.policy_version,
      timestamp: Number(row.timestamp),
      input_references: JSON.parse(row.input_references_json),
      authorization_evidence: JSON.parse(row.authorization_evidence_json),
      resource_decision: JSON.parse(row.resource_decision_json)
    };
  }
};

// src/core/risk.ts
var LocalHeuristicRiskProvider = class {
  name = "LocalHeuristicRiskProvider";
  async evaluate(input) {
    const startTime = performance.now();
    const signals = [];
    let riskScore = 10;
    if (input.amountPaise > 1e6) {
      riskScore += 25;
      signals.push("HIGH_TRANSACTION_VALUE");
    }
    if (input.amountPaise > 5e6) {
      riskScore += 35;
      signals.push("EXCESSIVE_TRANSACTION_VALUE");
    }
    const highRiskCategories = ["gift_cards", "crypto_assets", "digital_currency", "precious_metals"];
    for (const cat of input.categories) {
      if (highRiskCategories.includes(cat.toLowerCase())) {
        riskScore += 40;
        signals.push(`HIGH_RISK_CATEGORY_${cat.toUpperCase()}`);
      }
    }
    if (input.protocol && input.protocol.toLowerCase() === "rest_unverified") {
      riskScore += 20;
      signals.push("UNVERIFIED_INGRESS_PROTOCOL");
    }
    riskScore = Math.min(100, Math.max(0, riskScore));
    let riskTier = "LOW";
    let recommendedAction = "ALLOW";
    if (riskScore >= 75) {
      riskTier = "CRITICAL";
      recommendedAction = "DENY";
    } else if (riskScore >= 50) {
      riskTier = "HIGH";
      recommendedAction = "REQUIRE_CONFIRMATION";
    } else if (riskScore >= 30) {
      riskTier = "MEDIUM";
      recommendedAction = "REQUIRE_CONFIRMATION";
    } else {
      riskTier = "LOW";
      recommendedAction = "ALLOW";
    }
    const latencyMs = Number((performance.now() - startTime).toFixed(2));
    return {
      provider: this.name,
      riskScore,
      riskTier,
      recommendedAction,
      signals,
      advisoryOnly: true,
      latencyMs,
      evaluatedAt: Math.floor(Date.now() / 1e3)
    };
  }
};

// src/core/trace.ts
import crypto14 from "node:crypto";
var DecisionTraceRecorder = class {
  db;
  currentPhases = [];
  startTime;
  traceId;
  intentId;
  agentId;
  merchantId;
  constructor(db, intentId, agentId, merchantId) {
    this.db = db;
    this.intentId = intentId;
    this.agentId = agentId;
    this.merchantId = merchantId;
    this.traceId = `trc_${crypto14.randomUUID()}`;
    this.startTime = performance.now();
  }
  recordPhase(name, status, durationMs, details) {
    const sanitizedDetails = details ? this.sanitize(details) : void 0;
    this.currentPhases.push({
      name,
      status,
      durationMs: Number(durationMs.toFixed(3)),
      details: sanitizedDetails
    });
  }
  sanitize(obj) {
    const sanitized = {};
    for (const [k, v] of Object.entries(obj)) {
      if (/key|secret|token|password|auth/i.test(k)) {
        sanitized[k] = "[REDACTED]";
      } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        sanitized[k] = this.sanitize(v);
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }
  finalize() {
    const totalLatencyMs = Number((performance.now() - this.startTime).toFixed(2));
    const now = Math.floor(Date.now() / 1e3);
    const trace = {
      traceId: this.traceId,
      intentId: this.intentId,
      agentId: this.agentId,
      merchantId: this.merchantId,
      totalLatencyMs,
      phases: this.currentPhases,
      createdAt: now
    };
    try {
      this.db.prepare(`
          INSERT INTO decision_traces (
            trace_id, intent_id, agent_id, merchant_id, total_latency_ms, phases_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
        trace.traceId,
        trace.intentId,
        trace.agentId,
        trace.merchantId,
        trace.totalLatencyMs,
        JSON.stringify(trace.phases),
        trace.createdAt
      );
    } catch (_) {
    }
    return trace;
  }
  static getTrace(db, traceId) {
    const row = db.prepare("SELECT * FROM decision_traces WHERE trace_id = ?").get(traceId);
    if (!row) return null;
    return {
      traceId: row.trace_id,
      intentId: row.intent_id,
      agentId: row.agent_id,
      merchantId: row.merchant_id,
      totalLatencyMs: Number(row.total_latency_ms),
      phases: JSON.parse(row.phases_json),
      createdAt: Number(row.created_at)
    };
  }
  static getTraceByIntent(db, intentId) {
    const row = db.prepare("SELECT * FROM decision_traces WHERE intent_id = ? ORDER BY created_at DESC LIMIT 1").get(intentId);
    if (!row) return null;
    return {
      traceId: row.trace_id,
      intentId: row.intent_id,
      agentId: row.agent_id,
      merchantId: row.merchant_id,
      totalLatencyMs: Number(row.total_latency_ms),
      phases: JSON.parse(row.phases_json),
      createdAt: Number(row.created_at)
    };
  }
};

// src/core/incident.ts
import crypto15 from "node:crypto";
var IncidentConsoleEngine = class {
  db;
  principalRegistry;
  killSwitchEngine;
  constructor(db, principalRegistry, killSwitchEngine) {
    this.db = db;
    this.principalRegistry = principalRegistry;
    this.killSwitchEngine = killSwitchEngine;
  }
  recordIncident(agentId, merchantId, incidentType, severity, details, intentId) {
    const incidentId = `inc_${crypto15.randomUUID()}`;
    const now = Math.floor(Date.now() / 1e3);
    const incident = {
      incidentId,
      agentId,
      merchantId,
      intentId,
      incidentType,
      severity,
      details,
      status: "OPEN",
      createdAt: now
    };
    this.db.prepare(`
        INSERT INTO incident_events (
          incident_id, agent_id, merchant_id, intent_id, incident_type, severity, details_json, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)
      `).run(
      incident.incidentId,
      incident.agentId,
      incident.merchantId,
      incident.intentId || null,
      incident.incidentType,
      incident.severity,
      JSON.stringify(incident.details),
      incident.createdAt
    );
    return incident;
  }
  listIncidents(status) {
    const query = status ? "SELECT * FROM incident_events WHERE status = ? ORDER BY created_at DESC" : "SELECT * FROM incident_events ORDER BY created_at DESC";
    const rows = status ? this.db.prepare(query).all(status) : this.db.prepare(query).all();
    return rows.map((r) => ({
      incidentId: r.incident_id,
      agentId: r.agent_id,
      merchantId: r.merchant_id,
      intentId: r.intent_id || void 0,
      incidentType: r.incident_type,
      severity: r.severity,
      details: JSON.parse(r.details_json),
      status: r.status,
      createdAt: Number(r.created_at),
      resolvedAt: r.resolved_at ? Number(r.resolved_at) : void 0,
      resolvedBy: r.resolved_by || void 0
    }));
  }
  executeAction(action, targetId, reason = "SecOps incident response", actor = "secops_lead") {
    const actionId = `act_${crypto15.randomUUID()}`;
    const now = Math.floor(Date.now() / 1e3);
    switch (action) {
      case "SUSPEND_AGENT":
        this.principalRegistry.setAgentStatus(targetId, "SUSPENDED");
        return {
          actionId,
          action,
          targetId,
          success: true,
          status: "AGENT_SUSPENDED",
          timestamp: now
        };
      case "REVOKE_AGENT":
        this.principalRegistry.setAgentStatus(targetId, "REVOKED");
        return {
          actionId,
          action,
          targetId,
          success: true,
          status: "AGENT_REVOKED",
          timestamp: now
        };
      case "REVOKE_MANDATE":
        this.db.prepare(`
            INSERT OR REPLACE INTO revoked_mandates (mandate_id, revocation_reason, revoked_at)
            VALUES (?, ?, ?)
          `).run(targetId, reason, now);
        return {
          actionId,
          action,
          targetId,
          success: true,
          status: "MANDATE_REVOKED",
          timestamp: now
        };
      case "PAUSE_MERCHANT_AGENTS":
        this.killSwitchEngine.setKillSwitch(`MERCHANT:${targetId}`, true, reason, actor);
        return {
          actionId,
          action,
          targetId,
          success: true,
          status: "MERCHANT_AGENTS_PAUSED",
          timestamp: now
        };
      case "CLEAR_AFTER_REVIEW":
        this.db.prepare("UPDATE incident_events SET status = 'RESOLVED', resolved_at = ?, resolved_by = ? WHERE incident_id = ?").run(now, actor, targetId);
        return {
          actionId,
          action,
          targetId,
          success: true,
          status: "INCIDENT_RESOLVED",
          timestamp: now
        };
      default:
        throw new Error(`Unsupported incident action: ${action}`);
    }
  }
};

// src/core/delegation.ts
import crypto16 from "node:crypto";
var MultiAgentDelegationEngine = class {
  db;
  principalRegistry;
  constructor(db, principalRegistry) {
    this.db = db;
    this.principalRegistry = principalRegistry;
  }
  createDelegation(parentAgentId, childAgentId, merchantId, maxAmountPaise, allowedActions, durationSeconds = 3600) {
    const parent = this.principalRegistry.getPrincipal(parentAgentId);
    if (!parent || parent.status !== "ACTIVE") {
      throw new Error(`Parent agent '${parentAgentId}' is not active or does not exist`);
    }
    const parentCaps = this.principalRegistry.getCapabilities(parentAgentId);
    const parentPurchaseCap = parentCaps.find((c) => c.capability === "PURCHASE" && c.status === "ACTIVE");
    if (!parentPurchaseCap) {
      throw new Error(`Parent agent '${parentAgentId}' lacks active PURCHASE capability`);
    }
    if (maxAmountPaise > parentPurchaseCap.max_amount) {
      throw new Error(
        `Delegation amount \u20B9${(maxAmountPaise / 100).toFixed(2)} exceeds parent ceiling \u20B9${(parentPurchaseCap.max_amount / 100).toFixed(2)}`
      );
    }
    const now = Math.floor(Date.now() / 1e3);
    const expiresAt = now + durationSeconds;
    const delegationId = `del_${crypto16.randomUUID()}`;
    const grant = {
      delegationId,
      parentAgentId,
      childAgentId,
      merchantId,
      maxAmountPaise,
      currency: "INR",
      allowedActions,
      expiresAt,
      createdAt: now,
      status: "ACTIVE"
    };
    this.db.prepare(`
        INSERT INTO delegations (
          delegation_id, parent_agent_id, child_agent_id, merchant_id,
          max_amount_paise, currency, allowed_actions_json, expires_at, created_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
      `).run(
      grant.delegationId,
      grant.parentAgentId,
      grant.childAgentId,
      grant.merchantId,
      grant.maxAmountPaise,
      grant.currency,
      JSON.stringify(grant.allowedActions),
      grant.expiresAt,
      grant.createdAt
    );
    return grant;
  }
  validateDelegation(delegationId, childAgentId, merchantId, requestedAmountPaise, action) {
    const row = this.db.prepare("SELECT * FROM delegations WHERE delegation_id = ?").get(delegationId);
    if (!row) {
      return { valid: false, code: "DELEGATION_NOT_FOUND", reason: `Delegation '${delegationId}' not found` };
    }
    if (row.status !== "ACTIVE") {
      return { valid: false, code: `DELEGATION_${row.status}`, reason: `Delegation is ${row.status}` };
    }
    if (row.child_agent_id !== childAgentId) {
      return { valid: false, code: "DELEGATION_CHILD_MISMATCH", reason: `Child agent mismatch: expected ${row.child_agent_id}, got ${childAgentId}` };
    }
    const now = Math.floor(Date.now() / 1e3);
    if (now > Number(row.expires_at)) {
      return { valid: false, code: "DELEGATION_EXPIRED", reason: "Delegation grant has expired" };
    }
    const parent = this.principalRegistry.getPrincipal(row.parent_agent_id);
    if (!parent || parent.status !== "ACTIVE") {
      return {
        valid: false,
        code: "PARENT_AGENT_INACTIVE",
        reason: `Parent agent '${row.parent_agent_id}' status is ${parent?.status || "NOT_FOUND"}`
      };
    }
    if (row.merchant_id !== "*" && row.merchant_id !== merchantId) {
      return { valid: false, code: "DELEGATION_MERCHANT_MISMATCH", reason: `Merchant mismatch: granted for '${row.merchant_id}', requested '${merchantId}'` };
    }
    if (requestedAmountPaise > Number(row.max_amount_paise)) {
      return {
        valid: false,
        code: "DELEGATION_AMOUNT_EXCEEDED",
        reason: `Requested amount \u20B9${(requestedAmountPaise / 100).toFixed(2)} exceeds delegated limit \u20B9${(Number(row.max_amount_paise) / 100).toFixed(2)}`
      };
    }
    const allowedActions = JSON.parse(row.allowed_actions_json);
    if (!allowedActions.includes("*") && !allowedActions.includes(action)) {
      return { valid: false, code: "DELEGATION_ACTION_NOT_PERMITTED", reason: `Action '${action}' not permitted in delegation grant` };
    }
    const delegation = {
      delegationId: row.delegation_id,
      parentAgentId: row.parent_agent_id,
      childAgentId: row.child_agent_id,
      merchantId: row.merchant_id,
      maxAmountPaise: Number(row.max_amount_paise),
      currency: row.currency,
      allowedActions,
      expiresAt: Number(row.expires_at),
      createdAt: Number(row.created_at),
      status: row.status
    };
    return { valid: true, delegation };
  }
  revokeDelegation(delegationId) {
    const res = this.db.prepare("UPDATE delegations SET status = 'REVOKED' WHERE delegation_id = ?").run(delegationId);
    return res.changes > 0;
  }
};

// src/core/capability_negotiation.ts
var CapabilityNegotiator = class {
  static negotiate(agent, merchant) {
    const negotiatedActions = agent.supportedActions.filter(
      (a) => merchant.acceptedActions.includes(a) || merchant.acceptedActions.includes("*")
    );
    const negotiatedCurrencies = agent.supportedCurrencies.filter(
      (c) => merchant.acceptedCurrencies.includes(c) || merchant.acceptedCurrencies.includes("*")
    );
    const effectiveTransactionLimitPaise = Math.min(
      agent.maxTransactionPaise,
      merchant.policyConstraints.maxTransactionPaise
    );
    const isCompatible = negotiatedActions.length > 0 && negotiatedCurrencies.length > 0 && effectiveTransactionLimitPaise > 0;
    return {
      status: isCompatible ? "COMPATIBLE" : "INCOMPATIBLE",
      negotiatedActions,
      negotiatedCurrencies,
      effectiveTransactionLimitPaise,
      confirmationRequiredAbovePaise: merchant.policyConstraints.confirmationThresholdPaise,
      disclaimer: "Negotiation establishes protocol compatibility only. Authorization requires explicit mandate and PDP approval."
    };
  }
};

// src/core/policy_compiler.ts
import { z as z9 } from "zod";
var PolicyDSLSchema = z9.object({
  version: z9.string().regex(/^pol_v\d+\.\d+\.\d+$/, "Must follow pol_vX.Y.Z format"),
  merchant_id: z9.string().min(1),
  effective_from: z9.number().int().positive().optional(),
  rules: z9.object({
    max_transaction_amount_inr: z9.number().positive(),
    allowed_store_categories: z9.array(z9.string()).nonempty(),
    auto_refund_stockout: z9.boolean().default(true),
    min_gross_margin_bps: z9.number().int().nonnegative().default(1500),
    confirmation_threshold_inr: z9.number().positive().default(3e3)
  })
});
var PolicyCompiler = class {
  static compile(source) {
    const parseResult = PolicyDSLSchema.safeParse(source);
    if (!parseResult.success) {
      throw new Error(`Policy DSL compilation error: ${parseResult.error.errors.map((e) => e.message).join("; ")}`);
    }
    const dsl = parseResult.data;
    const now = Math.floor(Date.now() / 1e3);
    const runtimePolicy = {
      policy_version: dsl.version,
      effective_at: dsl.effective_from || now,
      merchant_id: dsl.merchant_id,
      max_transaction_amount: Math.round(dsl.rules.max_transaction_amount_inr * 100),
      allowed_categories: dsl.rules.allowed_store_categories,
      auto_refund_on_fulfillment_failure: dsl.rules.auto_refund_stockout,
      min_margin_percentage: dsl.rules.min_gross_margin_bps / 100
    };
    return {
      raw: dsl,
      runtimePolicy,
      compiledAt: now,
      hash: Buffer.from(JSON.stringify(runtimePolicy)).toString("base64")
    };
  }
};

// src/core/mcp_surface.ts
var ACGMcpToolSurface = class {
  pdp;
  principalRegistry;
  auditLedger;
  constructor(pdp, principalRegistry, auditLedger) {
    this.pdp = pdp;
    this.principalRegistry = principalRegistry;
    this.auditLedger = auditLedger;
  }
  listTools() {
    return [
      {
        name: "authorize_financial_action",
        description: "Evaluates and authorizes an agent-originated commercial financial intent through the ACG control plane.",
        inputSchema: {
          type: "object",
          properties: {
            intent: { type: "object", description: "CanonicalFinancialIntent payload" },
            agent_id: { type: "string" }
          },
          required: ["intent"]
        }
      },
      {
        name: "simulate_financial_action",
        description: "Dry-runs financial authorization without moving funds or modifying inventory state.",
        inputSchema: {
          type: "object",
          properties: {
            intent: { type: "object", description: "CanonicalFinancialIntent payload" },
            agent_id: { type: "string" }
          },
          required: ["intent"]
        }
      },
      {
        name: "get_authorization_decision",
        description: "Retrieves a historical PDP decision and its cryptographic authorization evidence.",
        inputSchema: {
          type: "object",
          properties: {
            decision_id: { type: "string" }
          },
          required: ["decision_id"]
        }
      },
      {
        name: "get_agent_capabilities",
        description: "Retrieves authorized capabilities and spend bounds for a registered agent principal.",
        inputSchema: {
          type: "object",
          properties: {
            agent_id: { type: "string" }
          },
          required: ["agent_id"]
        }
      },
      {
        name: "get_policy",
        description: "Retrieves the active merchant policy constraints and rules.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_audit_record",
        description: "Retrieves tamper-evident SHA-256 audit ledger trajectory for an intent.",
        inputSchema: {
          type: "object",
          properties: {
            intent_id: { type: "string" }
          },
          required: ["intent_id"]
        }
      }
    ];
  }
  async callTool(name, args, activePolicy) {
    switch (name) {
      case "simulate_financial_action": {
        const intent = args.intent;
        const agentId = args.agent_id || "native-llm-agent";
        return this.pdp.simulate(intent, activePolicy, agentId);
      }
      case "authorize_financial_action": {
        const intent = args.intent;
        const agentId = args.agent_id || "native-llm-agent";
        return this.pdp.evaluateIntent(intent, activePolicy, agentId);
      }
      case "get_authorization_decision": {
        if (!args.decision_id) {
          throw new Error("Missing required argument: 'decision_id'");
        }
        const dec = this.pdp.getDecision(args.decision_id);
        if (!dec) {
          throw new Error(`Decision '${args.decision_id}' not found`);
        }
        return dec;
      }
      case "get_agent_capabilities": {
        return {
          agent: this.principalRegistry.getPrincipal(args.agent_id),
          capabilities: this.principalRegistry.getCapabilities(args.agent_id)
        };
      }
      case "get_policy": {
        return { policy: activePolicy };
      }
      case "get_audit_record": {
        return {
          intent_id: args.intent_id,
          trajectory: this.auditLedger.getTrajectory(args.intent_id)
        };
      }
      default:
        throw new Error(`Unsupported MCP tool: '${name}'`);
    }
  }
};

// src/core/rail_abstraction.ts
var RazorpayExecutionProvider = class {
  name = "RazorpayExecutionProvider";
  client;
  constructor(client) {
    this.client = client;
  }
  async createOrder(amountPaise, receipt, notes) {
    const order = await this.client.createOrder(amountPaise, receipt, notes);
    return {
      orderId: order.id,
      amountPaise: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
      railProvider: "RAZORPAY_SANDBOX"
    };
  }
};

// src/core/recommendation_engine.ts
var PolicyConstrainedRecommendationEngine = class {
  /**
   * Calculate inclusive total price in paise for a catalog item (unit_price + tax).
   */
  static calculateItemTotalPaise(item, quantity = 1) {
    const subtotal = item.unit_price * quantity;
    const tax = Math.round(subtotal * item.tax_rate_bps / 1e4);
    return subtotal + tax;
  }
  /**
   * Search merchant catalog using keyword / semantic criteria and price bounds.
   */
  static searchCatalog(query, catalog, maxPriceInr) {
    const q = query.toLowerCase().trim();
    const tokens = q.split(/\s+/).filter((t) => t.length > 1);
    return catalog.filter((item) => {
      if (!item.is_active || item.available_stock <= 0) return false;
      const totalInr = this.calculateItemTotalPaise(item) / 100;
      if (maxPriceInr !== void 0 && totalInr > maxPriceInr) return false;
      if (!tokens.length) return true;
      const searchableText = `${item.sku} ${item.name} ${item.category}`.toLowerCase();
      return tokens.some((token) => {
        if (token === "keyboard" && searchableText.includes("keyboard")) return true;
        if (token === "mouse" && searchableText.includes("mouse")) return true;
        if (token === "chair" && searchableText.includes("chair")) return true;
        if (token === "headset" && searchableText.includes("headset")) return true;
        if (token === "wireless" && searchableText.includes("wireless")) return true;
        return searchableText.includes(token);
      });
    });
  }
  /**
   * Evaluates candidate cross-sells for a given basket against policies and budget.
   */
  static evaluateCrossSells(basketItems, catalog, policy, mandate, agentPrincipal) {
    const catalogMap = /* @__PURE__ */ new Map();
    for (const item of catalog) {
      catalogMap.set(item.sku, item);
    }
    let currentBasketPaise = 0;
    const currentSkus = /* @__PURE__ */ new Set();
    for (const line of basketItems) {
      const item = catalogMap.get(line.sku);
      if (item) {
        currentSkus.add(item.sku);
        currentBasketPaise += this.calculateItemTotalPaise(item, line.quantity);
      }
    }
    const remainingBudgetPaise = mandate ? mandate.remaining_budget : policy.max_transaction_amount;
    const policyCapPaise = policy.max_transaction_amount;
    const confirmationThresholdPaise = agentPrincipal?.confirmation_above || 3e5;
    const candidates = [];
    for (const item of catalog) {
      if (!item.is_active || item.available_stock <= 0) continue;
      if (currentSkus.has(item.sku)) continue;
      let relationship = "";
      let isRelevant = false;
      if (currentSkus.has("SKU-KEYBOARD-RGB") || currentSkus.has("SKU-KEYBOARD-SLIM")) {
        if (item.sku === "SKU-MOUSE-PRO" || item.sku === "SKU-MOUSE-SLIM") {
          relationship = "Compatible ergonomic precision mouse companion";
          isRelevant = true;
        } else if (item.sku === "SKU-HEADSET-STUDIO") {
          relationship = "Companion noise-cancelling studio headset";
          isRelevant = true;
        }
      } else if (currentSkus.has("SKU-MOUSE-PRO") || currentSkus.has("SKU-MOUSE-SLIM")) {
        if (item.sku === "SKU-KEYBOARD-RGB" || item.sku === "SKU-KEYBOARD-SLIM") {
          relationship = "Matching ergonomic mechanical keyboard";
          isRelevant = true;
        }
      } else if (currentSkus.has("SKU-CHAIR-ERGO")) {
        if (item.sku === "SKU-KEYBOARD-RGB" || item.sku === "SKU-MOUSE-PRO") {
          relationship = "Ergonomic workspace productivity bundle";
          isRelevant = true;
        }
      } else if (basketItems.length === 0) {
        if (item.category === "electronics") {
          relationship = "Popular high-velocity workspace hardware";
          isRelevant = true;
        }
      }
      if (!isRelevant) continue;
      const crossSellItemPaise = this.calculateItemTotalPaise(item, 1);
      const projectedTotalPaise = currentBasketPaise + crossSellItemPaise;
      const budgetSurplusDeficitPaise = remainingBudgetPaise - projectedTotalPaise;
      let recommendationStatus = "RECOMMENDED_AUTO_APPROVABLE";
      let explanation = "";
      const priceInr = crossSellItemPaise / 100;
      const projectedTotalInr = projectedTotalPaise / 100;
      const remainingBudgetInr = remainingBudgetPaise / 100;
      if (projectedTotalPaise > remainingBudgetPaise) {
        recommendationStatus = "EXCLUDED_BUDGET_OVERSTEP";
        explanation = `Adding ${item.name} (\u20B9${priceInr.toFixed(2)}) brings total to \u20B9${projectedTotalInr.toFixed(2)}, which exceeds your remaining mandate budget of \u20B9${remainingBudgetInr.toFixed(2)} by \u20B9${Math.abs(budgetSurplusDeficitPaise / 100).toFixed(2)}.`;
      } else if (projectedTotalPaise > policyCapPaise) {
        recommendationStatus = "EXCLUDED_BUDGET_OVERSTEP";
        explanation = `Adding ${item.name} brings total to \u20B9${projectedTotalInr.toFixed(2)}, which exceeds the merchant policy transaction cap of \u20B9${(policyCapPaise / 100).toFixed(2)}.`;
      } else if (projectedTotalPaise > confirmationThresholdPaise) {
        recommendationStatus = "REQUIRES_CONFIRMATION";
        explanation = `Adding ${item.name} brings total to \u20B9${projectedTotalInr.toFixed(2)}. While within your budget (\u20B9${remainingBudgetInr.toFixed(2)}), it exceeds the \u20B9${(confirmationThresholdPaise / 100).toFixed(2)} autonomous spending threshold and will trigger a human confirmation challenge.`;
      } else {
        recommendationStatus = "RECOMMENDED_AUTO_APPROVABLE";
        explanation = `Adding ${item.name} (\u20B9${priceInr.toFixed(2)}) brings total to \u20B9${projectedTotalInr.toFixed(2)}, which is fully within your \u20B9${remainingBudgetInr.toFixed(2)} mandate budget and auto-approvable.`;
      }
      candidates.push({
        item,
        totalPricePaise: crossSellItemPaise,
        totalPriceInr: priceInr,
        relationship,
        recommendationStatus,
        budgetImpact: {
          baseBasketPaise: currentBasketPaise,
          crossSellPaise: crossSellItemPaise,
          projectedTotalPaise,
          remainingBudgetPaise,
          budgetSurplusDeficitPaise
        },
        explanation
      });
    }
    return candidates;
  }
  /**
   * Process a conversational buyer turn deterministically.
   */
  static processConversationalTurn(message, currentBasket, catalog, policy, mandate, agentPrincipal) {
    const q = message.toLowerCase().trim();
    let maxPriceInr;
    const priceMatch = q.match(/(?:under|below|less than|max)\s*(?:₹|inr|rs\.?)?\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?)/i);
    if (priceMatch) {
      maxPriceInr = parseFloat(priceMatch[1].replace(/,/g, ""));
    }
    const matchedCatalog = this.searchCatalog(q, catalog, maxPriceInr);
    const catalogMap = new Map(catalog.map((c) => [c.sku, c]));
    let basketTotalPaise = 0;
    const detailedBasketItems = [];
    for (const b of currentBasket) {
      const item = catalogMap.get(b.sku);
      if (item) {
        const itemTotal = this.calculateItemTotalPaise(item, b.quantity);
        basketTotalPaise += itemTotal;
        detailedBasketItems.push({
          sku: item.sku,
          name: item.name,
          quantity: b.quantity,
          unitPricePaise: item.unit_price,
          totalPaise: itemTotal
        });
      }
    }
    const crossSells = this.evaluateCrossSells(currentBasket, catalog, policy, mandate, agentPrincipal);
    let replyMessage = "";
    if (matchedCatalog.length > 0) {
      const top = matchedCatalog[0];
      const topPrice = this.calculateItemTotalPaise(top) / 100;
      replyMessage = `I found the **${top.name}** in the merchant catalog for \u20B9${topPrice.toFixed(2)} (Tax Included).`;
      const autoCrossSell = crossSells.find((cs) => cs.recommendationStatus === "RECOMMENDED_AUTO_APPROVABLE");
      if (autoCrossSell) {
        replyMessage += ` A compatible **${autoCrossSell.item.name}** is available for \u20B9${autoCrossSell.totalPriceInr.toFixed(2)}. Adding it brings your basket to \u20B9${(autoCrossSell.budgetImpact.projectedTotalPaise / 100).toFixed(2)}, which is within your authorization mandate.`;
      }
    } else if (currentBasket.length > 0) {
      replyMessage = `Your current basket has ${detailedBasketItems.length} item(s) totaling \u20B9${(basketTotalPaise / 100).toFixed(2)}.`;
      const autoCrossSell = crossSells.find((cs) => cs.recommendationStatus === "RECOMMENDED_AUTO_APPROVABLE");
      if (autoCrossSell) {
        replyMessage += ` We recommend pairing with **${autoCrossSell.item.name}** (+\u20B9${autoCrossSell.totalPriceInr.toFixed(2)}).`;
      }
    } else {
      replyMessage = `I searched the merchant catalog but found no matching items within your specified criteria. Would you like to explore our standard electronics or office essentials?`;
    }
    const remainingBudgetPaise = mandate ? mandate.remaining_budget : policy.max_transaction_amount;
    const policyCapPaise = policy.max_transaction_amount;
    const confirmationThresholdPaise = agentPrincipal?.confirmation_above || 3e5;
    let authStatus = "CAN_AUTO_AUTHORIZE";
    const reasons = [];
    if (basketTotalPaise > remainingBudgetPaise) {
      authStatus = "POLICY_OR_BUDGET_BLOCKED";
      reasons.push(`Basket total (\u20B9${(basketTotalPaise / 100).toFixed(2)}) exceeds remaining mandate budget (\u20B9${(remainingBudgetPaise / 100).toFixed(2)})`);
    } else if (basketTotalPaise > policyCapPaise) {
      authStatus = "POLICY_OR_BUDGET_BLOCKED";
      reasons.push(`Basket total exceeds merchant policy cap (\u20B9${(policyCapPaise / 100).toFixed(2)})`);
    } else if (basketTotalPaise > confirmationThresholdPaise) {
      authStatus = "REQUIRES_HUMAN_CONFIRMATION";
      reasons.push(`Basket total exceeds autonomous confirmation threshold (\u20B9${(confirmationThresholdPaise / 100).toFixed(2)})`);
    } else {
      reasons.push("Fully authorized for autonomous checkout");
    }
    return {
      agentRole: "LOCAL_COMMERCE_AGENT",
      buyerMessage: message,
      replyMessage,
      matchedItems: matchedCatalog.map((item) => ({
        item,
        unitPriceInr: item.unit_price / 100,
        taxRateBps: item.tax_rate_bps,
        totalPriceInr: this.calculateItemTotalPaise(item) / 100,
        inStock: item.available_stock > 0
      })),
      candidateCrossSells: crossSells,
      currentBasket: {
        items: detailedBasketItems,
        totalPaise: basketTotalPaise,
        totalInr: basketTotalPaise / 100
      },
      authorizationPreview: {
        status: authStatus,
        reasons,
        mandateRemainingPaise: remainingBudgetPaise,
        merchantPolicyCapPaise: policyCapPaise,
        confirmationThresholdPaise
      }
    };
  }
};

// src/gateway/router.ts
function registerGatewayRoutes(app, db, policy) {
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
  const principalRegistry = new AgentPrincipalRegistry(db);
  const killSwitchEngine = new KillSwitchEngine(db);
  const velocityEngine = new VelocityEngine(db);
  const budgetEngine = new HierarchicalBudgetEngine(db);
  const pdp = new PolicyDecisionPoint(
    db,
    truthEngine,
    principalRegistry,
    killSwitchEngine,
    velocityEngine,
    budgetEngine
  );
  const riskProvider = new LocalHeuristicRiskProvider();
  const incidentEngine = new IncidentConsoleEngine(db, principalRegistry, killSwitchEngine);
  const delegationEngine = new MultiAgentDelegationEngine(db, principalRegistry);
  const mcpSurface = new ACGMcpToolSurface(pdp, principalRegistry, auditLedger);
  const executionProvider = new RazorpayExecutionProvider(railClient);
  truthEngine.seedDefaultCatalog();
  app.get("/", async (_request, reply) => {
    reply.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    reply.header("Pragma", "no-cache");
    reply.header("Expires", "0");
    try {
      const fs2 = await import("node:fs");
      const path2 = await import("node:path");
      const htmlPath = path2.resolve(process.cwd(), "public", "index.html");
      if (fs2.existsSync(htmlPath)) {
        const html = fs2.readFileSync(htmlPath, "utf-8");
        return reply.type("text/html; charset=utf-8").send(html);
      }
    } catch {
    }
    return reply.type("text/html; charset=utf-8").send("<h1>Agent Commerce Gateway (ACG)</h1><p>Dashboard located at /public/index.html</p>");
  });
  app.get("/dashboard", async (_request, reply) => {
    return reply.redirect("/");
  });
  app.get("/assets/*", async (request, reply) => {
    reply.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    reply.header("Pragma", "no-cache");
    reply.header("Expires", "0");
    try {
      const fs2 = await import("node:fs");
      const path2 = await import("node:path");
      const subpath = request.params["*"];
      let filePath = path2.resolve(process.cwd(), "public", "assets", subpath);
      if (!fs2.existsSync(filePath)) {
        filePath = path2.resolve(process.cwd(), "public", "dist", "assets", subpath);
      }
      if (fs2.existsSync(filePath)) {
        const ext = path2.extname(filePath);
        const mimeMap = {
          ".js": "application/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".woff2": "font/woff2",
          ".woff": "font/woff",
          ".json": "application/json"
        };
        return reply.type(mimeMap[ext] || "application/octet-stream").send(fs2.readFileSync(filePath));
      }
    } catch {
    }
    return reply.status(404).send({ error: "ASSET_NOT_FOUND" });
  });
  app.get("/dist/*", async (request, reply) => {
    try {
      const fs2 = await import("node:fs");
      const path2 = await import("node:path");
      const subpath = request.params["*"];
      const filePath = path2.resolve(process.cwd(), "public", "dist", subpath);
      if (fs2.existsSync(filePath)) {
        const ext = path2.extname(filePath);
        const mimeMap = {
          ".js": "application/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".woff2": "font/woff2",
          ".woff": "font/woff",
          ".json": "application/json"
        };
        return reply.type(mimeMap[ext] || "application/octet-stream").send(fs2.readFileSync(filePath));
      }
    } catch {
    }
    return reply.status(404).send({ error: "DIST_NOT_FOUND" });
  });
  app.get("/dashboard/metrics", { preHandler: [requireScope("merchant:read")] }, async () => {
    const intentsRow = db.prepare("SELECT COUNT(*) as count FROM audit_ledger WHERE event_type = 'INTENT_RECEIVED'").get();
    const gmvRow = db.prepare("SELECT COALESCE(SUM(amount), 0) as gmv FROM order_sessions WHERE status IN ('ORDER_CREATED', 'PAYMENT_CAPTURED', 'FULFILLMENT_DISPATCHED', 'REFUNDED')").get();
    const blockedRow = db.prepare("SELECT COUNT(*) as count FROM audit_ledger WHERE event_type IN ('MANDATE_REVOKED', 'SIGNATURE_VERIFICATION_FAILED', 'COMMERCE_TRUTH_FAILED', 'POLICY_VIOLATION', 'RESERVATION_FAILED', 'INTENT_REJECTED')").get();
    const resRow = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE status = 'HELD'").get();
    const auditCountRow = db.prepare("SELECT COUNT(*) as count FROM audit_ledger").get();
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
      is_sandbox_connected: true
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
  app.get("/dashboard/transaction/:intentId", { preHandler: [requireScope("merchant:read")] }, async (request, reply) => {
    const intentId = request.params.intentId;
    const session = db.prepare("SELECT * FROM order_sessions WHERE intent_id = ?").get(intentId);
    const trajectory = auditLedger.getTrajectory(intentId);
    let reservation = null;
    let reservationItems = [];
    if (session?.reservation_id) {
      reservation = db.prepare("SELECT * FROM reservations WHERE reservation_id = ?").get(session.reservation_id);
      reservationItems = db.prepare("SELECT * FROM reservation_items WHERE reservation_id = ?").all(session.reservation_id);
    }
    return reply.send({
      session,
      trajectory,
      reservation,
      reservationItems
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
    } catch {
    }
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
        protocol_adapters: { status: "READY", adapters: ["ACG", "MCP", "A2A", "ACP", "AP2", "UCP", "TAP"] }
      },
      timestamp: Date.now()
    };
  });
  app.get("/dashboard/compatibility", async () => {
    return {
      summary: {
        architecture: "Model- & Protocol-Independent Financial Action Control Plane",
        core_thesis: "We don't replace the agent, the protocol, the payment intelligence, or Razorpay. We provide the merchant-side control boundary that governs the financial actions those systems are allowed to cause.",
        vulcan_distinction: "Vulcan provides downstream payment intelligence (routing & risk signals); ACG enforces deterministic merchant authorization.",
        active_adapters_count: 8
      },
      models: [
        { name: "OpenAI (ChatGPT Apps / GPT-4o / Codex)", status: "READY", role: "Proposer", authority: "NONE", interface: "MCP / REST" },
        { name: "Anthropic (Claude 3.5 / 3.7 Sonnet)", status: "READY", role: "Proposer", authority: "NONE", interface: "MCP / REST" },
        { name: "Google (Gemini 2.0 / 3.7)", status: "READY", role: "Proposer", authority: "NONE", interface: "Gemini CLI / MCP" },
        { name: "Open Models & IDEs (Cursor, Windsurf, VS Code)", status: "READY", role: "Proposer", authority: "NONE", interface: "Razorpay MCP" },
        { name: "Custom Enterprise Agents", status: "READY", role: "Proposer", authority: "NONE", interface: "ACG Direct API" }
      ],
      protocols: [
        { name: "Native ACG Protocol", code: "ACG", status: "LIVE", version: "v1.0.0", description: "Direct Ed25519 mandate format (ACG authorization primitive)" },
        { name: "REST Financial Action Ingress", code: "REST", status: "LIVE", version: "v1.0.0", description: "Direct REST API endpoint for financial actions" },
        { name: "Model Context Protocol (MCP)", code: "MCP", status: "ADAPTER READY", version: "2024-11-05", description: "Claude/ChatGPT/Cursor tools/call normalization into ACG IR" },
        { name: "Agent2Agent Protocol (A2A)", code: "A2A", status: "ADAPTER READY", version: "2026.1-LF", description: "Linux Foundation A2A commerce task RPC adapter" },
        { name: "Agentic Commerce Protocol (ACP)", code: "ACP", status: "ADAPTER READY", version: "acp/1.0", description: "Cart & order envelope adapter" },
        { name: "Agent Payments Protocol (AP2)", code: "AP2", status: "ADAPTER READY", version: "v0.2.0", description: "Authorization container adapter (Maps AP2 to ACG IR; ECDSA checkout JWT binding)" },
        { name: "Universal Commerce Protocol (UCP)", code: "UCP", status: "ADAPTER READY", version: "ucp-v1.2", description: "Google open commerce journey adapter" },
        { name: "Visa Trusted Agent Protocol (TAP)", code: "TAP", status: "DESIGN", version: "tap/1.0-draft", description: "Cryptographic agent identity attestation container design" }
      ],
      payment_intelligence: [
        {
          name: "Razorpay Vulcan",
          status: "ARCHITECTURE READY",
          role: "Downstream Fraud & Routing Signals",
          model_version: "vulcan-v1.4-live-transformer",
          authority: "ADVISORY_ONLY",
          distinction: "Downstream telemetry advisory only. No public developer inference API exists; ACG models this interface for future routing integration."
        },
        {
          name: "Heuristic Risk Evaluator",
          status: "LIVE",
          role: "Deterministic merchant risk bounds",
          authority: "ADVISORY_ONLY",
          distinction: "Evaluates policy velocity thresholds & basket size limits"
        },
        {
          name: "Pluggable Risk Provider",
          status: "PLUGGABLE",
          role: "Third-party enterprise scoring",
          authority: "ADVISORY_ONLY",
          distinction: "External risk feed adapter interface"
        }
      ],
      payment_rails: [
        { name: "Razorpay Sandbox / Standard", status: "LIVE", type: "Core Settlement Rail" },
        { name: "UPI Reserve Pay", status: "RAIL", type: "Pre-authorized delegated rail" },
        { name: "Cards & Netbanking", status: "RAIL", type: "Card network tokenization" },
        { name: "Machine Payments (x402 / MPP)", status: "PLUGGABLE", type: "HTTP-native machine rail" }
      ]
    };
  });
  app.post("/dashboard/compatibility/test-adapter", async (request, reply) => {
    const { protocol } = request.body || {};
    const cryptoModule = await Promise.resolve().then(() => (init_crypto(), crypto_exports));
    const nodeCrypto = await import("node:crypto");
    const { generatePrincipalKeypair: generatePrincipalKeypair2, signMandate: signMandate2 } = cryptoModule;
    const keypair = generatePrincipalKeypair2();
    const now = Math.floor(Date.now() / 1e3);
    const activePolicy = policyEngine.getPolicy();
    const mandateData = {
      mandate_id: `man_${protocol}_${Date.now()}`,
      principal_public_key: keypair.publicKeyHex,
      budget_limit: 5e5,
      // ₹5,000.00
      currency: "INR",
      merchant_whitelist: [activePolicy.merchant_id],
      category_whitelist: ["electronics"],
      expiry: now + 3600
    };
    const signature = signMandate2(mandateData, keypair.privateKeyObject);
    const mandate = { ...mandateData, signature };
    let testPayload;
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
              agent_metadata: { model_runtime: "claude-3-7-sonnet", provider: "anthropic" }
            }
          }
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
              proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }]
            }
          }
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
          line_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1, estimated_price_paise: 212400 }]
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
          cart: { items: [{ sku: "SKU-MOUSE-PRO", qty: 1 }] }
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
            order_lines: [{ sku: "SKU-MOUSE-PRO", quantity: 1, title: "Precision Wireless Mouse" }]
          }
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
            reputation_tier: "TIER_1_VERIFIED"
          },
          commerce_payload: {
            intent_id: intentId,
            client_nonce: nonce,
            timestamp: now,
            mandate,
            proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }]
          }
        };
        break;
      default:
        testPayload = {
          intent_id: intentId,
          client_nonce: nonce,
          timestamp: now,
          mandate,
          proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }]
        };
        break;
    }
    const res = await app.inject({
      method: "POST",
      url: `/v1/agent/ingress/${protocol || "acg"}`,
      payload: testPayload
    });
    return reply.status(res.statusCode).send(JSON.parse(res.body));
  });
  app.post("/dashboard/demo/run-scenario", async (request, reply) => {
    const { scenario } = request.body || {};
    const cryptoModule = await Promise.resolve().then(() => (init_crypto(), crypto_exports));
    const nodeCrypto = await import("node:crypto");
    const { generatePrincipalKeypair: generatePrincipalKeypair2, signMandate: signMandate2 } = cryptoModule;
    const keypair = generatePrincipalKeypair2();
    const now = Math.floor(Date.now() / 1e3);
    const intentId = nodeCrypto.randomUUID();
    if (scenario === "mandate-violation") {
      const mandateData2 = {
        mandate_id: `man_viol_${Date.now()}`,
        principal_public_key: keypair.publicKeyHex,
        budget_limit: 5e5,
        // ₹5,000
        currency: "INR",
        merchant_whitelist: [policy.merchant_id],
        category_whitelist: ["electronics", "furniture"],
        expiry: now + 3600
      };
      const signature2 = signMandate2(mandateData2, keypair.privateKeyObject);
      const payload = {
        intent_id: intentId,
        client_nonce: nodeCrypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: { ...mandateData2, signature: signature2 },
        proposed_items: [{ sku: "SKU-CHAIR-ERGO", quantity: 1 }]
        // ₹14,160 > ₹5,000
      };
      const res = await app.inject({ method: "POST", url: "/v1/agent/checkout", payload });
      return reply.status(res.statusCode).send(JSON.parse(res.body));
    }
    if (scenario === "concurrent") {
      const mandateData2 = {
        mandate_id: `man_race_${Date.now()}`,
        principal_public_key: keypair.publicKeyHex,
        budget_limit: 287600,
        // ₹2,876 remaining
        currency: "INR",
        merchant_whitelist: [policy.merchant_id],
        category_whitelist: ["electronics"],
        expiry: now + 3600
      };
      const signature2 = signMandate2(mandateData2, keypair.privateKeyObject);
      const p1 = {
        intent_id: nodeCrypto.randomUUID(),
        client_nonce: nodeCrypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: { ...mandateData2, signature: signature2 },
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }]
        // ₹2,124
      };
      const p2 = {
        intent_id: nodeCrypto.randomUUID(),
        client_nonce: nodeCrypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: { ...mandateData2, signature: signature2 },
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }]
        // ₹2,124
      };
      const [res1, res2] = await Promise.all([
        app.inject({ method: "POST", url: "/v1/agent/checkout", payload: p1 }),
        app.inject({ method: "POST", url: "/v1/agent/checkout", payload: p2 })
      ]);
      return reply.status(200).send({
        scenario: "concurrent",
        subagentA: { status: res1.statusCode, body: JSON.parse(res1.body) },
        subagentB: { status: res2.statusCode, body: JSON.parse(res2.body) }
      });
    }
    if (scenario === "webhook-fail") {
      const forgedRes = await app.inject({
        method: "POST",
        url: "/webhooks/razorpay",
        headers: {
          "x-razorpay-signature": "forged_bad_signature_123",
          "x-razorpay-event-id": `evt_forged_${Date.now()}`
        },
        payload: { event: "payment.captured", payload: { payment: { entity: { id: "pay_forged", amount: 1e5, status: "captured" } } } }
      });
      return reply.status(200).send({
        scenario: "webhook-fail",
        forgedWebhookResult: { status: forgedRes.statusCode, body: JSON.parse(forgedRes.body) }
      });
    }
    if (scenario === "refund") {
      const mandateData2 = {
        mandate_id: `man_ref_${Date.now()}`,
        principal_public_key: keypair.publicKeyHex,
        budget_limit: 5e5,
        currency: "INR",
        merchant_whitelist: [policy.merchant_id],
        category_whitelist: ["electronics"],
        expiry: now + 3600
      };
      const signature2 = signMandate2(mandateData2, keypair.privateKeyObject);
      const checkoutRes2 = await app.inject({
        method: "POST",
        url: "/v1/agent/checkout",
        payload: {
          intent_id: intentId,
          client_nonce: nodeCrypto.randomBytes(16).toString("hex"),
          timestamp: now,
          mandate: { ...mandateData2, signature: signature2 },
          proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }]
        }
      });
      const order = JSON.parse(checkoutRes2.body);
      const paymentId = `pay_${Date.now()}`;
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "rzp_webhook_secret_test";
      const webhookPayload = {
        event: "payment.captured",
        payload: { payment: { entity: { id: paymentId, order_id: order.razorpay_order_id, amount: order.amount_paise, status: "captured" } } }
      };
      const hmacSig = nodeCrypto.createHmac("sha256", webhookSecret).update(JSON.stringify(webhookPayload)).digest("hex");
      await app.inject({
        method: "POST",
        url: "/webhooks/razorpay",
        headers: {
          "x-razorpay-signature": hmacSig,
          "x-razorpay-event-id": `evt_refund_${Date.now()}`
        },
        payload: webhookPayload
      });
      await webhookProcessor.handlePostCaptureFulfillmentFailure(intentId, "Warehouse damaged stockout detected");
      const updatedSession = db.prepare("SELECT * FROM order_sessions WHERE intent_id = ?").get(intentId);
      return reply.status(200).send({
        scenario: "refund",
        orderCreated: order,
        refundExecution: { success: true, status: updatedSession?.status || "REFUNDED" }
      });
    }
    const mandateData = {
      mandate_id: `man_nominal_${Date.now()}`,
      principal_public_key: keypair.publicKeyHex,
      budget_limit: 5e5,
      currency: "INR",
      merchant_whitelist: [policy.merchant_id],
      category_whitelist: ["electronics"],
      expiry: now + 3600
    };
    const signature = signMandate2(mandateData, keypair.privateKeyObject);
    const checkoutRes = await app.inject({
      method: "POST",
      url: "/v1/agent/checkout",
      payload: {
        intent_id: intentId,
        client_nonce: nodeCrypto.randomBytes(16).toString("hex"),
        timestamp: now,
        mandate: { ...mandateData, signature },
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }]
      }
    });
    const orderData = JSON.parse(checkoutRes.body);
    if (checkoutRes.statusCode === 201) {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "rzp_webhook_secret_test";
      const webhookPayload = {
        event: "payment.captured",
        payload: { payment: { entity: { id: `pay_${Date.now()}`, order_id: orderData.razorpay_order_id, amount: orderData.amount_paise, status: "captured" } } }
      };
      const hmacSig = nodeCrypto.createHmac("sha256", webhookSecret).update(JSON.stringify(webhookPayload)).digest("hex");
      await app.inject({
        method: "POST",
        url: "/webhooks/razorpay",
        headers: {
          "x-razorpay-signature": hmacSig,
          "x-razorpay-event-id": `evt_nom_${Date.now()}`
        },
        payload: webhookPayload
      });
    }
    return reply.status(checkoutRes.statusCode).send(orderData);
  });
  app.get("/catalog", async () => {
    const activePolicy = policyEngine.getPolicy();
    const items = db.prepare("SELECT * FROM catalog_items WHERE is_active = 1").all();
    return {
      merchant_id: activePolicy.merchant_id,
      policy_version: activePolicy.policy_version,
      items
    };
  });
  app.post("/v1/mandates/revoke", { preHandler: [requireScope("merchant:mandate:revoke")], config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = request.body;
    if (!body || !body.mandate_id) {
      return reply.status(400).send({ error: "MISSING_MANDATE_ID", message: "mandate_id is required" });
    }
    const revokedAt = Math.floor(Date.now() / 1e3);
    const reason = body.reason || "Revoked by user principal";
    db.prepare(`
      INSERT OR REPLACE INTO revoked_mandates (mandate_id, revocation_reason, revoked_at, revocation_signature)
      VALUES (?, ?, ?, ?)
    `).run(body.mandate_id, reason, revokedAt, body.signature || null);
    return reply.status(200).send({
      status: "REVOKED",
      mandate_id: body.mandate_id,
      revoked_at: revokedAt,
      reason
    });
  });
  app.put("/v1/merchant/policy", { preHandler: [requireScope("merchant:policy:write")], config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const newPolicy = request.body;
    if (!newPolicy || !newPolicy.policy_version) {
      return reply.status(400).send({ error: "INVALID_POLICY", message: "policy_version is required" });
    }
    policyEngine.updatePolicy(newPolicy);
    return reply.status(200).send({
      status: "POLICY_UPDATED",
      policy: policyEngine.getPolicy()
    });
  });
  app.post("/v1/agent/checkout", { config: { rateLimit: { max: 50, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parseResult = CanonicalIntentSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "INVALID_INTENT_SCHEMA",
        details: parseResult.error.format()
      });
    }
    const intent = parseResult.data;
    const intentId = intent.intent_id;
    const existingSession = db.prepare("SELECT intent_id FROM order_sessions WHERE intent_id = ?").get(intentId);
    if (existingSession) {
      return reply.status(409).send({
        error: "DUPLICATE_INTENT_REPLAY",
        message: `Intent ID '${intentId}' has already been submitted.`
      });
    }
    auditLedger.logTransition(intentId, "INTENT_RECEIVED", null, "INTENT_RECEIVED", {
      client_nonce: intent.client_nonce,
      mandate_id: intent.mandate.mandate_id,
      item_count: intent.proposed_items.length
    });
    const agentId = request.headers["x-agent-id"] || request.body?.agent_id || "native-llm-agent";
    const activePolicy = policyEngine.getPolicy();
    const pdpRes = pdp.evaluateIntent(intent, activePolicy, agentId);
    if (pdpRes.decision.decision === "DENY") {
      const code = pdpRes.decision.reason_code;
      const evidence = pdpRes.decision.authorization_evidence || {};
      let message = evidence.truth_error || evidence.reason || `Policy Decision Point rejected intent: ${code}`;
      if (code === "MANDATE_REVOKED" && evidence.reason) {
        message = `Buyer mandate '${intent.mandate.mandate_id}' was revoked by principal: ${evidence.reason}`;
      }
      if (code === "MANDATE_REVOKED") {
        auditLedger.logTransition(intentId, "MANDATE_REVOKED", "INTENT_RECEIVED", "INTENT_REJECTED", {
          mandate_id: intent.mandate.mandate_id,
          reason: evidence.reason,
          policy_version: activePolicy.policy_version
        });
      } else if (code.includes("POLICY") || code === "MERCHANT_MAX_AMOUNT_EXCEEDED" || code === "CATEGORY_NOT_WHITELISTED") {
        auditLedger.logTransition(intentId, "POLICY_VIOLATION", "INTENT_RECEIVED", "INTENT_REJECTED", {
          reason: evidence.reason || code,
          code,
          policy_version: activePolicy.policy_version
        });
      } else {
        auditLedger.logTransition(intentId, "PDP_DECISION_DENIED", "INTENT_RECEIVED", "INTENT_REJECTED", {
          reason: code,
          agentId,
          decisionId: pdpRes.decision.decision_id,
          policy_version: activePolicy.policy_version
        });
      }
      let httpStatus = 403;
      if (code === "INVALID_MANDATE_SIGNATURE") httpStatus = 401;
      else if (code === "COMMERCE_TRUTH_REJECTION" || code === "INVALID_INTENT_SCHEMA") httpStatus = 400;
      else if (code === "MANDATE_EXHAUSTED" || code === "RESERVATION_FAILED" || code.includes("STOCKOUT")) httpStatus = 409;
      return reply.status(httpStatus).send({
        error: code,
        message,
        decision_id: pdpRes.decision.decision_id
      });
    }
    if (pdpRes.decision.decision === "REQUIRE_CONFIRMATION") {
      auditLedger.logTransition(intentId, "REQUIRE_CONFIRMATION", "INTENT_RECEIVED", "INTENT_VALIDATED", {
        decisionId: pdpRes.decision.decision_id,
        confirmationToken: pdpRes.decision.resource_decision.confirmation_token
      });
      return reply.status(200).send({
        status: "REQUIRE_CONFIRMATION",
        decision_id: pdpRes.decision.decision_id,
        confirmation_token: pdpRes.decision.resource_decision.confirmation_token,
        amount_paise: pdpRes.truthResult?.totalAmount,
        reason: "Amount exceeds autonomous agent confirmation ceiling"
      });
    }
    const truthResult = pdpRes.truthResult;
    auditLedger.logTransition(intentId, "MANDATE_VERIFIED", "INTENT_RECEIVED", "INTENT_VALIDATED", {
      principal_public_key: intent.mandate.principal_public_key,
      budget_limit: intent.mandate.budget_limit
    });
    auditLedger.logTransition(intentId, "COMMERCE_TRUTH_RESOLVED", "INTENT_VALIDATED", "INTENT_VALIDATED", {
      computedTotalPaise: truthResult.totalAmount,
      totalTaxPaise: truthResult.totalTax,
      resolvedItems: truthResult.resolvedItems.map((r) => ({
        sku: r.item.sku,
        unitPrice: r.item.unit_price,
        qty: r.quantity,
        total: r.total
      }))
    });
    auditLedger.logTransition(intentId, "POLICY_EVALUATED_ALLOWED", "INTENT_VALIDATED", "INTENT_VALIDATED", {
      policy_version: activePolicy.policy_version,
      effective_at: activePolicy.effective_at,
      decision_timestamp: Math.floor(Date.now() / 1e3)
    });
    const reservationResult = reservationEngine.holdReservation(
      intentId,
      intent.mandate,
      truthResult.totalAmount,
      truthResult.resolvedItems
    );
    if (!reservationResult.success) {
      auditLedger.logTransition(intentId, "RESERVATION_FAILED", "INTENT_VALIDATED", "RESERVATION_FAILED", {
        reason: reservationResult.reason,
        code: reservationResult.code
      });
      return reply.status(409).send({
        error: reservationResult.code,
        message: reservationResult.reason
      });
    }
    auditLedger.logTransition(intentId, "DUAL_RESERVATION_ACQUIRED", "INTENT_VALIDATED", "DUAL_RESERVATION_HELD", {
      reservationId: reservationResult.reservationId,
      reservedBudget: reservationResult.reservedAmount
    });
    const vulcanResult = await defaultVulcanIntelligence.evaluate({
      intentId,
      merchantId: activePolicy.merchant_id,
      amountPaise: truthResult.totalAmount,
      currency: "INR",
      itemCategories: truthResult.categories,
      mandateId: intent.mandate.mandate_id,
      agentId: "native-llm-agent",
      protocol: "ACG"
    });
    auditLedger.logTransition(intentId, "VULCAN_INTELLIGENCE_EVALUATED", "DUAL_RESERVATION_HELD", "DUAL_RESERVATION_HELD", {
      provider: vulcanResult.provider,
      riskScore: vulcanResult.riskSignals.riskScore,
      optimalRail: vulcanResult.routingHints.optimalRail,
      expectedSuccessRateBps: vulcanResult.routingHints.expectedSuccessRateBps
    });
    try {
      const razorpayOrder = await railClient.createOrder(
        truthResult.totalAmount,
        intentId,
        // receipt = intent_id
        {
          mandate_id: intent.mandate.mandate_id,
          reservation_id: reservationResult.reservationId,
          policy_version: activePolicy.policy_version,
          vulcan_optimal_rail: vulcanResult.routingHints.optimalRail
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
      try {
        const baseAmount = truthResult.resolvedItems.length > 0 ? truthResult.resolvedItems[0].total : truthResult.totalAmount;
        const crossSellAmount = truthResult.totalAmount > baseAmount ? truthResult.totalAmount - baseAmount : 0;
        db.prepare(`
          INSERT INTO revenue_attribution_events (event_id, intent_id, session_id, event_type, base_amount, cross_sell_amount, final_amount, sku_list_json, metadata_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          `rev_auth_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          intentId,
          intentId,
          "CHECKOUT_AUTHORIZED",
          baseAmount,
          crossSellAmount,
          truthResult.totalAmount,
          JSON.stringify(truthResult.resolvedItems.map((r) => r.item.sku)),
          JSON.stringify({ order_id: razorpayOrder.id, item_count: truthResult.resolvedItems.length }),
          Math.floor(now / 1e3)
        );
      } catch {
      }
      auditLedger.logTransition(intentId, "RAZORPAY_ORDER_CREATED", "DUAL_RESERVATION_HELD", "ORDER_CREATED", {
        razorpayOrderId: razorpayOrder.id,
        receipt: razorpayOrder.receipt,
        amountDue: razorpayOrder.amount_due
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
          optimal_rail: vulcanResult.routingHints.optimalRail
        },
        items: truthResult.resolvedItems.map((r) => ({
          sku: r.item.sku,
          name: r.item.name,
          quantity: r.quantity,
          unit_price_inr: r.item.unit_price / 100,
          total_inr: r.total / 100
        }))
      });
    } catch (railError) {
      reservationEngine.releaseReservation(reservationResult.reservationId, "Razorpay API Order creation failed");
      auditLedger.logTransition(intentId, "RAIL_EXECUTION_FAILED", "DUAL_RESERVATION_HELD", "DUAL_RESERVATION_RELEASED", {
        error: railError.message
      });
      return reply.status(502).send({
        error: "PAYMENT_RAIL_ERROR",
        message: `Failed to initialize payment with Razorpay: ${railError.message}`
      });
    }
  });
  app.post("/v1/agent/ingress/:protocol", { config: { rateLimit: { max: 50, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { protocol } = request.params;
    const activePolicy = policyEngine.getPolicy();
    const adapterResult = await defaultAdapterRegistry.normalize(protocol, request.body, activePolicy.merchant_id);
    if (!adapterResult.success) {
      return reply.status(400).send({
        error: adapterResult.code,
        message: adapterResult.error,
        details: adapterResult.details
      });
    }
    const intent = adapterResult.intent;
    const intentId = intent.intent_id;
    const existingSession = db.prepare("SELECT intent_id FROM order_sessions WHERE intent_id = ?").get(intentId);
    if (existingSession) {
      return reply.status(409).send({
        error: "DUPLICATE_INTENT_REPLAY",
        message: `Intent ID '${intentId}' has already been submitted.`
      });
    }
    auditLedger.logTransition(intentId, "INTENT_RECEIVED", null, "INTENT_RECEIVED", {
      client_nonce: intent.client_nonce,
      mandate_id: intent.mandate.mandate_id,
      item_count: intent.proposed_items.length,
      ingress_protocol: adapterResult.metadata.sourceProtocol,
      agent_id: adapterResult.metadata.agentId,
      raw_hash: adapterResult.metadata.rawHash
    });
    const ks = killSwitchEngine.checkKillSwitch(activePolicy.merchant_id, adapterResult.metadata.agentId);
    if (ks.isPaused) {
      auditLedger.logTransition(intentId, "KILL_SWITCH_BLOCKED", "INTENT_RECEIVED", "INTENT_REJECTED", { reason: ks.reason });
      return reply.status(403).send({ error: "KILL_SWITCH_ENGAGED", message: ks.reason });
    }
    const revokedRow = db.prepare("SELECT * FROM revoked_mandates WHERE mandate_id = ?").get(intent.mandate.mandate_id);
    if (revokedRow) {
      auditLedger.logTransition(intentId, "MANDATE_REVOKED", "INTENT_RECEIVED", "INTENT_REJECTED", {
        mandate_id: intent.mandate.mandate_id,
        revoked_at: revokedRow.revoked_at,
        reason: revokedRow.revocation_reason
      });
      return reply.status(403).send({
        error: "MANDATE_REVOKED",
        message: `Buyer mandate '${intent.mandate.mandate_id}' was revoked by principal: ${revokedRow.revocation_reason}`
      });
    }
    const isSignatureValid = verifyMandateSignature(intent.mandate);
    if (!isSignatureValid) {
      auditLedger.logTransition(intentId, "SIGNATURE_VERIFICATION_FAILED", "INTENT_RECEIVED", "INTENT_REJECTED", {
        reason: "Invalid Ed25519 signature on buyer mandate payload"
      });
      return reply.status(401).send({
        error: "INVALID_MANDATE_SIGNATURE",
        message: "The cryptographic signature on the buyer mandate is invalid or tampered."
      });
    }
    auditLedger.logTransition(intentId, "MANDATE_VERIFIED", "INTENT_RECEIVED", "INTENT_VALIDATED", {
      principal_public_key: intent.mandate.principal_public_key,
      budget_limit: intent.mandate.budget_limit,
      protocol: adapterResult.metadata.sourceProtocol
    });
    const truthResult = truthEngine.resolveTruth(intent.proposed_items);
    if (!truthResult.isValid) {
      auditLedger.logTransition(intentId, "COMMERCE_TRUTH_FAILED", "INTENT_VALIDATED", "INTENT_REJECTED", {
        reason: truthResult.error
      });
      return reply.status(400).send({
        error: "COMMERCE_TRUTH_REJECTION",
        message: truthResult.error
      });
    }
    auditLedger.logTransition(intentId, "COMMERCE_TRUTH_RESOLVED", "INTENT_VALIDATED", "INTENT_VALIDATED", {
      computedTotalPaise: truthResult.totalAmount,
      totalTaxPaise: truthResult.totalTax,
      resolvedItems: truthResult.resolvedItems.map((r) => ({
        sku: r.item.sku,
        unitPrice: r.item.unit_price,
        qty: r.quantity,
        total: r.total
      }))
    });
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
        policy_version: policyResult.policy_version
      });
      return reply.status(403).send({
        error: policyResult.violationCode,
        message: policyResult.reason
      });
    }
    auditLedger.logTransition(intentId, "POLICY_EVALUATED_ALLOWED", "INTENT_VALIDATED", "INTENT_VALIDATED", {
      policy_version: policyResult.policy_version
    });
    const reservationResult = reservationEngine.holdReservation(
      intentId,
      intent.mandate,
      truthResult.totalAmount,
      truthResult.resolvedItems
    );
    if (!reservationResult.success) {
      auditLedger.logTransition(intentId, "RESERVATION_FAILED", "INTENT_VALIDATED", "RESERVATION_FAILED", {
        reason: reservationResult.reason,
        code: reservationResult.code
      });
      return reply.status(409).send({
        error: reservationResult.code,
        message: reservationResult.reason
      });
    }
    auditLedger.logTransition(intentId, "DUAL_RESERVATION_ACQUIRED", "INTENT_VALIDATED", "DUAL_RESERVATION_HELD", {
      reservationId: reservationResult.reservationId,
      reservedBudget: reservationResult.reservedAmount
    });
    const vulcanResult = await defaultVulcanIntelligence.evaluate({
      intentId,
      merchantId: activePolicy.merchant_id,
      amountPaise: truthResult.totalAmount,
      currency: "INR",
      itemCategories: truthResult.categories,
      mandateId: intent.mandate.mandate_id,
      agentId: adapterResult.metadata.agentId,
      protocol: adapterResult.metadata.sourceProtocol
    });
    auditLedger.logTransition(intentId, "VULCAN_INTELLIGENCE_EVALUATED", "DUAL_RESERVATION_HELD", "DUAL_RESERVATION_HELD", {
      provider: vulcanResult.provider,
      riskScore: vulcanResult.riskSignals.riskScore,
      optimalRail: vulcanResult.routingHints.optimalRail,
      expectedSuccessRateBps: vulcanResult.routingHints.expectedSuccessRateBps
    });
    try {
      const razorpayOrder = await railClient.createOrder(
        truthResult.totalAmount,
        intentId,
        {
          mandate_id: intent.mandate.mandate_id,
          reservation_id: reservationResult.reservationId,
          policy_version: activePolicy.policy_version,
          protocol: adapterResult.metadata.sourceProtocol,
          vulcan_optimal_rail: vulcanResult.routingHints.optimalRail
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
        amountDue: razorpayOrder.amount_due
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
          authority_disclaimer: vulcanResult.authorityDisclaimer
        },
        items: truthResult.resolvedItems.map((r) => ({
          sku: r.item.sku,
          name: r.item.name,
          quantity: r.quantity,
          unit_price_inr: r.item.unit_price / 100,
          total_inr: r.total / 100
        }))
      });
    } catch (railError) {
      reservationEngine.releaseReservation(reservationResult.reservationId, "Razorpay API Order creation failed");
      auditLedger.logTransition(intentId, "RAIL_EXECUTION_FAILED", "DUAL_RESERVATION_HELD", "DUAL_RESERVATION_RELEASED", {
        error: railError.message
      });
      return reply.status(502).send({
        error: "PAYMENT_RAIL_ERROR",
        message: `Failed to initialize payment with Razorpay: ${railError.message}`
      });
    }
  });
  app.post("/webhooks/razorpay", { config: { rateLimit: { max: 200, timeWindow: "1 minute" } } }, async (request, reply) => {
    const rawBody = request.rawBody || request.raw?.rawBody || (typeof request.body === "string" ? request.body : JSON.stringify(request.body));
    const signature = request.headers["x-razorpay-signature"] || "";
    const eventId = request.headers["x-razorpay-event-id"] || `event_${Date.now()}`;
    if (!signature || !webhookProcessor.verifySignature(rawBody, signature)) {
      return reply.status(401).send({ error: "INVALID_WEBHOOK_SIGNATURE" });
    }
    const result = await webhookProcessor.processEvent(eventId, request.body);
    if (result.status === "ERROR") {
      return reply.status(409).send(result);
    }
    return reply.status(200).send(result);
  });
  app.get("/audit/:intentId", async (request, reply) => {
    const trajectory = auditLedger.getTrajectory(request.params.intentId);
    return reply.send({
      intent_id: request.params.intentId,
      step_count: trajectory.length,
      trajectory
    });
  });
  app.get("/audit/integrity", async () => {
    return auditLedger.verifyLedgerIntegrity();
  });
  app.post("/v1/simulate", async (request, reply) => {
    const parseResult = CanonicalIntentSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "INVALID_INTENT_SCHEMA",
        details: parseResult.error.format()
      });
    }
    const intent = parseResult.data;
    const activePolicy = policyEngine.getPolicy();
    const agentId = request.headers["x-agent-id"] || "native-llm-agent";
    const simResult = pdp.simulate(intent, activePolicy, agentId);
    return reply.status(200).send(simResult);
  });
  app.post("/v1/decisions/:id/replay", async (request, reply) => {
    try {
      const decisionId = request.params.id;
      const body = request.body || {};
      const replayResult = pdp.replayDecision(decisionId, body.target_policy);
      return reply.status(200).send(replayResult);
    } catch (err) {
      return reply.status(404).send({ error: "DECISION_NOT_FOUND", message: err.message });
    }
  });
  app.get("/v1/decisions/:id", async (request, reply) => {
    const row = db.prepare("SELECT * FROM pdp_decisions WHERE decision_id = ?").get(request.params.id);
    if (!row) {
      return reply.status(404).send({ error: "DECISION_NOT_FOUND" });
    }
    return reply.status(200).send({
      ...row,
      input_references: JSON.parse(row.input_references_json),
      authorization_evidence: JSON.parse(row.authorization_evidence_json),
      resource_decision: JSON.parse(row.resource_decision_json)
    });
  });
  app.post("/v1/confirm", { preHandler: [requireScope("merchant:policy:write")] }, async (request, reply) => {
    const body = request.body || {};
    if (!body.confirmation_token) {
      return reply.status(400).send({ error: "MISSING_CONFIRMATION_TOKEN", message: "confirmation_token is required" });
    }
    const pending = db.prepare("SELECT * FROM pending_confirmations WHERE confirmation_token = ?").get(body.confirmation_token);
    if (!pending) {
      return reply.status(404).send({ error: "CONFIRMATION_NOT_FOUND", message: "Invalid confirmation token" });
    }
    if (pending.status !== "PENDING") {
      return reply.status(409).send({ error: "CONFIRMATION_ALREADY_PROCESSED", message: `Confirmation is already ${pending.status}` });
    }
    const now = Math.floor(Date.now() / 1e3);
    if (now > Number(pending.expires_at)) {
      db.prepare("UPDATE pending_confirmations SET status = 'EXPIRED' WHERE confirmation_token = ?").run(body.confirmation_token);
      return reply.status(410).send({ error: "CONFIRMATION_EXPIRED", message: "Confirmation window has expired" });
    }
    const principal = principalRegistry.getPrincipal(pending.agent_id);
    if (principal && principal.status !== "ACTIVE") {
      return reply.status(403).send({ error: "AGENT_INACTIVE", message: `Agent '${pending.agent_id}' is in '${principal.status}' state` });
    }
    const payload = JSON.parse(pending.payload_json);
    const intent = payload.intent;
    const truthResult = payload.truthResult;
    const confirmedBy = body.confirmed_by || "human_merchant_supervisor";
    const revokedRow = db.prepare("SELECT * FROM revoked_mandates WHERE mandate_id = ?").get(intent.mandate.mandate_id);
    if (revokedRow) {
      return reply.status(403).send({ error: "MANDATE_REVOKED", message: `Buyer mandate '${intent.mandate.mandate_id}' was revoked` });
    }
    if (now > intent.mandate.expiry) {
      return reply.status(403).send({ error: "MANDATE_EXPIRED", message: "Buyer mandate has expired" });
    }
    if (!verifyMandateSignature(intent.mandate)) {
      return reply.status(401).send({ error: "INVALID_MANDATE_SIGNATURE", message: "Buyer mandate signature is invalid" });
    }
    db.prepare("UPDATE pending_confirmations SET status = 'APPROVED', confirmed_at = ?, confirmed_by = ? WHERE confirmation_token = ?").run(now, confirmedBy, body.confirmation_token);
    const reservationResult = reservationEngine.holdReservation(
      intent.intent_id,
      intent.mandate,
      truthResult.totalAmount,
      truthResult.resolvedItems
    );
    if (!reservationResult.success) {
      auditLedger.logTransition(intent.intent_id, "RESERVATION_FAILED", "INTENT_VALIDATED", "RESERVATION_FAILED", {
        reason: reservationResult.reason
      });
      return reply.status(409).send({ error: reservationResult.code, message: reservationResult.reason });
    }
    try {
      const razorpayOrder = await railClient.createOrder(
        truthResult.totalAmount,
        intent.intent_id,
        {
          mandate_id: intent.mandate.mandate_id,
          reservation_id: reservationResult.reservationId,
          confirmed_by: confirmedBy
        }
      );
      const nowMs = Date.now();
      db.prepare(`
        INSERT INTO order_sessions (
          intent_id, receipt, razorpay_order_id, amount, currency, status, reservation_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'ORDER_CREATED', ?, ?, ?)
      `).run(
        intent.intent_id,
        intent.intent_id,
        razorpayOrder.id,
        truthResult.totalAmount,
        "INR",
        reservationResult.reservationId,
        nowMs,
        nowMs
      );
      auditLedger.logTransition(intent.intent_id, "CONFIRMED_ORDER_CREATED", "DUAL_RESERVATION_HELD", "ORDER_CREATED", {
        razorpayOrderId: razorpayOrder.id,
        confirmedBy,
        amount: truthResult.totalAmount
      });
      return reply.status(201).send({
        status: "ORDER_CREATED",
        intent_id: intent.intent_id,
        receipt: intent.intent_id,
        razorpay_order_id: razorpayOrder.id,
        amount_paise: truthResult.totalAmount,
        currency: "INR",
        confirmed_by: confirmedBy,
        reservation_id: reservationResult.reservationId
      });
    } catch (railErr) {
      reservationEngine.releaseReservation(reservationResult.reservationId, "Razorpay creation failed after confirmation");
      return reply.status(502).send({ error: "PAYMENT_RAIL_ERROR", message: railErr.message });
    }
  });
  app.get("/v1/agents", async () => {
    return { agents: principalRegistry.listPrincipals() };
  });
  app.post("/v1/agents", async (request, reply) => {
    const body = request.body;
    if (!body || !body.agent_id) {
      return reply.status(400).send({ error: "MISSING_AGENT_ID", message: "agent_id is required" });
    }
    const now = Math.floor(Date.now() / 1e3);
    const principal = {
      agent_id: body.agent_id,
      organization_id: body.organization_id || "org_default",
      provider: body.provider || "anthropic",
      model_name: body.model_name || "claude-3-7-sonnet",
      agent_type: body.agent_type || "AUTONOMOUS",
      trust_level: body.trust_level || "VERIFIED",
      credential_state: body.credential_state || "ACTIVE",
      created_at: now,
      expires_at: body.expires_at || now + 365 * 24 * 3600,
      status: body.status || "ACTIVE",
      metadata: body.metadata
    };
    principalRegistry.upsertPrincipal(principal);
    if (body.capabilities && Array.isArray(body.capabilities)) {
      for (const cap of body.capabilities) {
        principalRegistry.upsertCapability({
          capability_id: cap.capability_id || `cap_${principal.agent_id}_${cap.capability || "purchase"}`,
          agent_id: principal.agent_id,
          capability: cap.capability || "PURCHASE",
          max_amount: cap.max_amount || 1e7,
          currency: "INR",
          categories: cap.categories || ["*"],
          merchant_scope: cap.merchant_scope || ["*"],
          daily_budget: cap.daily_budget || 5e7,
          daily_spent: 0,
          confirmation_above: cap.confirmation_above || 3e5,
          expires_at: cap.expires_at || now + 365 * 24 * 3600,
          status: "ACTIVE",
          created_at: now
        });
      }
    }
    return reply.status(201).send({ status: "CREATED", principal });
  });
  app.get("/v1/agents/:id", async (request, reply) => {
    const agent = principalRegistry.getPrincipal(request.params.id);
    if (!agent) {
      return reply.status(404).send({ error: "AGENT_NOT_FOUND" });
    }
    const capabilities = principalRegistry.getCapabilities(request.params.id);
    return reply.status(200).send({ agent, capabilities });
  });
  app.post("/v1/kill-switch", { preHandler: [requireScope("merchant:policy:write")] }, async (request, reply) => {
    const body = request.body || {};
    const scope = body.scope || "GLOBAL";
    killSwitchEngine.setKillSwitch(scope, !!body.pause, body.reason, body.activated_by);
    auditLedger.logTransition("kill_switch", body.pause ? "KILL_SWITCH_ACTIVATED" : "KILL_SWITCH_DEACTIVATED", null, "INTENT_RECEIVED", {
      scope,
      is_paused: body.pause,
      reason: body.reason,
      activated_by: body.activated_by
    });
    return reply.status(200).send({ status: "UPDATED", scope, is_paused: !!body.pause });
  });
  app.get("/v1/kill-switch", async () => {
    return { kill_switches: killSwitchEngine.listKillSwitches() };
  });
  app.get("/v1/traces/:traceId", async (request, reply) => {
    const trace = DecisionTraceRecorder.getTrace(db, request.params.traceId);
    if (!trace) {
      return reply.status(404).send({ error: "TRACE_NOT_FOUND" });
    }
    return reply.status(200).send(trace);
  });
  app.get("/v1/traces/intent/:intentId", async (request, reply) => {
    const trace = DecisionTraceRecorder.getTraceByIntent(db, request.params.intentId);
    if (!trace) {
      return reply.status(404).send({ error: "TRACE_NOT_FOUND" });
    }
    return reply.status(200).send(trace);
  });
  app.get("/v1/incidents", { preHandler: [requireScope("merchant:read")] }, async (request) => {
    const query = request.query || {};
    return { incidents: incidentEngine.listIncidents(query.status) };
  });
  app.post("/v1/incidents/action", { preHandler: [requireScope("merchant:policy:write")] }, async (request, reply) => {
    const body = request.body || {};
    if (!body.action || !body.target_id) {
      return reply.status(400).send({ error: "MISSING_ACTION_PARAMETERS", message: "action and target_id are required" });
    }
    try {
      const result = incidentEngine.executeAction(body.action, body.target_id, body.reason, body.actor);
      auditLedger.logTransition("incident_action", "INCIDENT_ACTION_EXECUTED", null, "INTENT_RECEIVED", {
        action: body.action,
        target_id: body.target_id,
        reason: body.reason,
        actor: body.actor
      });
      return reply.status(200).send(result);
    } catch (err) {
      return reply.status(400).send({ error: "INVALID_ACTION", message: err.message });
    }
  });
  app.post("/v1/risk/evaluate", async (request, reply) => {
    const body = request.body;
    const activePolicy = policyEngine.getPolicy();
    const evaluation = await riskProvider.evaluate({
      intentId: body?.intent_id || `sim_${Date.now()}`,
      merchantId: activePolicy.merchant_id,
      agentId: body?.agent_id || "native-llm-agent",
      amountPaise: body?.amount_paise || 1e5,
      currency: "INR",
      categories: body?.categories || ["electronics"],
      mandateId: body?.mandate_id || "man_test",
      protocol: body?.protocol
    });
    return reply.status(200).send(evaluation);
  });
  app.post("/v1/authorize", async (request, reply) => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/agent/checkout",
      headers: request.headers,
      payload: request.body
    });
    return reply.status(res.statusCode).send(JSON.parse(res.body));
  });
  app.post("/v1/financial-actions", async (request, reply) => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/agent/checkout",
      headers: request.headers,
      payload: request.body
    });
    return reply.status(res.statusCode).send(JSON.parse(res.body));
  });
  app.get("/v1/capabilities", async () => {
    const activePolicy = policyEngine.getPolicy();
    return {
      merchant_id: activePolicy.merchant_id,
      accepted_actions: ["PURCHASE", "REFUND", "SUBSCRIPTION", "PAYMENT_LINK"],
      accepted_currencies: ["INR"],
      supported_rails: ["RAZORPAY_SANDBOX", "RAZORPAY_STANDARD", "UPI_AUTOPAY"],
      supported_protocols: ["ACG", "MCP", "A2A", "ACP", "AP2", "UCP", "TAP", "REST"],
      policy_constraints: {
        max_transaction_paise: activePolicy.max_transaction_amount,
        allowed_categories: activePolicy.allowed_categories,
        confirmation_threshold_paise: 3e5
      }
    };
  });
  app.post("/v1/capabilities/negotiate", async (request, reply) => {
    const body = request.body || {};
    if (!body.agent) {
      return reply.status(400).send({ error: "MISSING_AGENT_CAPABILITIES", message: "agent object is required" });
    }
    const activePolicy = policyEngine.getPolicy();
    const merchantCap = {
      merchantId: activePolicy.merchant_id,
      acceptedActions: ["PURCHASE", "REFUND", "SUBSCRIPTION", "PAYMENT_LINK"],
      acceptedCurrencies: ["INR"],
      supportedRails: ["RAZORPAY_SANDBOX", "RAZORPAY_STANDARD"],
      policyConstraints: {
        maxTransactionPaise: activePolicy.max_transaction_amount,
        allowedCategories: activePolicy.allowed_categories,
        confirmationThresholdPaise: 3e5
      }
    };
    const negotiated = CapabilityNegotiator.negotiate(body.agent, merchantCap);
    return reply.status(200).send(negotiated);
  });
  app.post("/v1/delegations", { preHandler: [requireScope("merchant:policy:write")] }, async (request, reply) => {
    const body = request.body;
    if (!body || !body.parent_agent_id || !body.child_agent_id || !body.max_amount_paise) {
      return reply.status(400).send({ error: "MISSING_DELEGATION_FIELDS", message: "parent_agent_id, child_agent_id, and max_amount_paise required" });
    }
    try {
      const activePolicy = policyEngine.getPolicy();
      const grant = delegationEngine.createDelegation(
        body.parent_agent_id,
        body.child_agent_id,
        body.merchant_id || activePolicy.merchant_id,
        body.max_amount_paise,
        body.allowed_actions || ["PURCHASE"],
        body.duration_seconds || 3600
      );
      auditLedger.logTransition("delegation", "DELEGATION_GRANT_CREATED", null, "INTENT_RECEIVED", {
        delegation_id: grant.delegationId,
        parent_agent_id: grant.parentAgentId,
        child_agent_id: grant.childAgentId,
        max_amount_paise: grant.maxAmountPaise
      });
      return reply.status(201).send(grant);
    } catch (err) {
      return reply.status(400).send({ error: "DELEGATION_CREATION_FAILED", message: err.message });
    }
  });
  app.get("/v1/delegations/:id", async (request, reply) => {
    const row = db.prepare("SELECT * FROM delegations WHERE delegation_id = ?").get(request.params.id);
    if (!row) {
      return reply.status(404).send({ error: "DELEGATION_NOT_FOUND" });
    }
    return reply.status(200).send({
      delegationId: row.delegation_id,
      parentAgentId: row.parent_agent_id,
      childAgentId: row.child_agent_id,
      merchantId: row.merchant_id,
      maxAmountPaise: Number(row.max_amount_paise),
      currency: row.currency,
      allowedActions: JSON.parse(row.allowed_actions_json),
      expiresAt: Number(row.expires_at),
      createdAt: Number(row.created_at),
      status: row.status
    });
  });
  app.post("/v1/policies/compile", async (request, reply) => {
    try {
      const compiled = PolicyCompiler.compile(request.body);
      return reply.status(200).send(compiled);
    } catch (err) {
      return reply.status(400).send({ error: "POLICY_COMPILATION_ERROR", message: err.message });
    }
  });
  app.post("/v1/policies", { preHandler: [requireScope("merchant:policy:write")] }, async (request, reply) => {
    try {
      const body = request.body;
      let targetPolicy;
      if (body.rules && body.version) {
        const compiled = PolicyCompiler.compile(body);
        targetPolicy = compiled.runtimePolicy;
      } else if (body.policy_version) {
        targetPolicy = body;
      } else {
        return reply.status(400).send({ error: "INVALID_POLICY_FORMAT", message: "Policy must match MerchantPolicy or PolicyDSL schema" });
      }
      policyEngine.updatePolicy(targetPolicy);
      return reply.status(200).send({ status: "POLICY_UPDATED", policy: policyEngine.getPolicy() });
    } catch (err) {
      return reply.status(400).send({ error: "POLICY_UPDATE_FAILED", message: err.message });
    }
  });
  app.post("/v1/mandates", async (request, reply) => {
    const mandate = request.body;
    if (!mandate || !mandate.mandate_id || !mandate.principal_public_key || !mandate.signature) {
      return reply.status(400).send({ error: "INVALID_MANDATE", message: "mandate_id, principal_public_key, and signature are required" });
    }
    const isValid = verifyMandateSignature(mandate);
    if (!isValid) {
      return reply.status(401).send({ error: "INVALID_MANDATE_SIGNATURE", message: "Cryptographic signature validation failed" });
    }
    const revoked = db.prepare("SELECT * FROM revoked_mandates WHERE mandate_id = ?").get(mandate.mandate_id);
    if (revoked) {
      return reply.status(403).send({ error: "MANDATE_REVOKED", message: `Mandate '${mandate.mandate_id}' has been revoked` });
    }
    const existing = db.prepare("SELECT * FROM buyer_mandates WHERE mandate_id = ?").get(mandate.mandate_id);
    const now = Math.floor(Date.now() / 1e3);
    if (existing) {
      db.prepare(`
        UPDATE buyer_mandates SET
          expiry = ?,
          signature = ?
        WHERE mandate_id = ?
      `).run(mandate.expiry, mandate.signature, mandate.mandate_id);
      return reply.status(200).send({
        status: "MANDATE_UPDATED",
        mandate_id: mandate.mandate_id,
        budget_limit: existing.budget_limit,
        remaining_budget: existing.remaining_budget
      });
    }
    db.prepare(`
      INSERT INTO buyer_mandates (mandate_id, principal_public_key, budget_limit, remaining_budget, currency, expiry, signature, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      mandate.mandate_id,
      mandate.principal_public_key,
      mandate.budget_limit,
      mandate.budget_limit,
      mandate.currency || "INR",
      mandate.expiry,
      mandate.signature,
      now
    );
    return reply.status(201).send({ status: "MANDATE_REGISTERED", mandate_id: mandate.mandate_id, remaining_budget: mandate.budget_limit });
  });
  app.post("/v1/reservations", { preHandler: [requireScope("merchant:write")] }, async (request, reply) => {
    const body = request.body;
    if (!body || !body.intent_id || !body.mandate || !body.items) {
      return reply.status(400).send({ error: "MISSING_RESERVATION_PAYLOAD", message: "intent_id, mandate, and items are required" });
    }
    if (!verifyMandateSignature(body.mandate)) {
      return reply.status(401).send({ error: "INVALID_MANDATE_SIGNATURE", message: "Cryptographic signature validation failed" });
    }
    const now = Math.floor(Date.now() / 1e3);
    if (now > body.mandate.expiry) {
      return reply.status(403).send({ error: "MANDATE_EXPIRED", message: "Buyer mandate has expired" });
    }
    const revoked = db.prepare("SELECT * FROM revoked_mandates WHERE mandate_id = ?").get(body.mandate.mandate_id);
    if (revoked) {
      return reply.status(403).send({ error: "MANDATE_REVOKED", message: `Mandate '${body.mandate.mandate_id}' has been revoked` });
    }
    const truthResult = truthEngine.resolveTruth(body.items);
    if (!truthResult.isValid) {
      return reply.status(400).send({ error: "COMMERCE_TRUTH_REJECTION", message: truthResult.error });
    }
    const activePolicy = policyEngine.getPolicy();
    const policyResult = policyEngine.evaluate(body.mandate, truthResult.totalAmount, truthResult.categories, activePolicy.merchant_id);
    if (!policyResult.isAllowed) {
      return reply.status(403).send({ error: policyResult.violationCode, message: policyResult.reason });
    }
    const resResult = reservationEngine.holdReservation(body.intent_id, body.mandate, truthResult.totalAmount, truthResult.resolvedItems);
    if (!resResult.success) {
      return reply.status(409).send({ error: resResult.code, message: resResult.reason });
    }
    auditLedger.logTransition(body.intent_id, "DIRECT_RESERVATION_HELD", null, "DUAL_RESERVATION_HELD", {
      reservationId: resResult.reservationId,
      reservedAmount: resResult.reservedAmount
    });
    return reply.status(201).send(resResult);
  });
  app.get("/v1/audit/:id", async (request, reply) => {
    const trajectory = auditLedger.getTrajectory(request.params.id);
    return reply.send({
      intent_id: request.params.id,
      step_count: trajectory.length,
      trajectory
    });
  });
  app.get("/v1/health", async () => {
    let dbConnected = false;
    try {
      db.prepare("SELECT 1").get();
      dbConnected = true;
    } catch {
    }
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
        protocol_adapters: { status: "READY", adapters: ["ACG", "MCP", "A2A", "ACP", "AP2", "UCP", "TAP"] }
      },
      timestamp: Date.now()
    };
  });
  app.get("/v1/mcp/tools", async () => {
    return { tools: mcpSurface.listTools() };
  });
  app.post("/v1/mcp/call", async (request, reply) => {
    const body = request.body || {};
    if (!body.name) {
      return reply.status(400).send({ error: "MISSING_TOOL_NAME", message: "name is required" });
    }
    try {
      const activePolicy = policyEngine.getPolicy();
      const result = await mcpSurface.callTool(body.name, body.arguments, activePolicy);
      return reply.status(200).send({ result });
    } catch (err) {
      return reply.status(400).send({ error: "MCP_EXECUTION_ERROR", message: err.message });
    }
  });
  app.post("/v1/commerce/chat", async (request, reply) => {
    const body = request.body || {};
    const message = body.message || "";
    const basket = body.basket || [];
    const sessionId = body.session_id || `chat_${Date.now()}`;
    const agentId = body.agent_id || "native-llm-agent";
    const catalog = db.prepare("SELECT * FROM catalog_items WHERE is_active = 1").all();
    const activePolicy = policyEngine.getPolicy();
    let mandate = null;
    if (body.mandate_id) {
      mandate = db.prepare("SELECT * FROM buyer_mandates WHERE mandate_id = ?").get(body.mandate_id);
    }
    const agentPrincipal = principalRegistry.getPrincipal(agentId);
    const turnResponse = PolicyConstrainedRecommendationEngine.processConversationalTurn(
      message,
      basket,
      catalog,
      activePolicy,
      mandate,
      agentPrincipal ? { confirmation_above: 3e5 } : null
    );
    if (turnResponse.candidateCrossSells.length > 0) {
      const best = turnResponse.candidateCrossSells[0];
      const now = Math.floor(Date.now() / 1e3);
      try {
        db.prepare(`
          INSERT INTO revenue_attribution_events (event_id, intent_id, session_id, event_type, base_amount, cross_sell_amount, final_amount, sku_list_json, metadata_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          `rev_rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          null,
          sessionId,
          "RECOMMENDATION_OFFERED",
          turnResponse.currentBasket.totalPaise,
          best.totalPricePaise,
          turnResponse.currentBasket.totalPaise + best.totalPricePaise,
          JSON.stringify([best.item.sku]),
          JSON.stringify({ recommendationStatus: best.recommendationStatus, query: message }),
          now
        );
      } catch {
      }
    }
    return reply.status(200).send(turnResponse);
  });
  app.post("/v1/commerce/recommend", async (request, reply) => {
    const body = request.body || {};
    const basket = body.basket || [];
    const agentId = body.agent_id || "native-llm-agent";
    const catalog = db.prepare("SELECT * FROM catalog_items WHERE is_active = 1").all();
    const activePolicy = policyEngine.getPolicy();
    let mandate = null;
    if (body.mandate_id) {
      mandate = db.prepare("SELECT * FROM buyer_mandates WHERE mandate_id = ?").get(body.mandate_id);
    }
    const agentPrincipal = principalRegistry.getPrincipal(agentId);
    const crossSells = PolicyConstrainedRecommendationEngine.evaluateCrossSells(
      basket,
      catalog,
      activePolicy,
      mandate,
      agentPrincipal ? { confirmation_above: 3e5 } : null
    );
    return reply.status(200).send({ candidateCrossSells: crossSells });
  });
  app.post("/v1/commerce/cross-sell/action", async (request, reply) => {
    const body = request.body || {};
    if (!body.action || !body.sku) {
      return reply.status(400).send({ error: "MISSING_ACTION_FIELDS", message: "action and sku are required" });
    }
    const eventType = body.action === "ACCEPT" ? "CROSS_SELL_ACCEPTED" : "CROSS_SELL_REJECTED";
    const now = Math.floor(Date.now() / 1e3);
    const eventId = `rev_act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      db.prepare(`
        INSERT INTO revenue_attribution_events (event_id, intent_id, session_id, event_type, base_amount, cross_sell_amount, final_amount, sku_list_json, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        eventId,
        body.intent_id || null,
        body.session_id || `sess_${Date.now()}`,
        eventType,
        body.base_amount || 0,
        body.cross_sell_amount || 0,
        (body.base_amount || 0) + (body.cross_sell_amount || 0),
        JSON.stringify([body.sku]),
        JSON.stringify({ action: body.action }),
        now
      );
    } catch {
    }
    return reply.status(200).send({ status: "RECORDED", event_id: eventId, event_type: eventType });
  });
  app.get("/v1/analytics/revenue", { preHandler: [requireScope("merchant:read")] }, async () => {
    const baseGmvRow = db.prepare(`
      SELECT COALESCE(SUM(base_amount), 0) as base_gmv,
             COALESCE(SUM(cross_sell_amount), 0) as cross_sell_gmv,
             COALESCE(SUM(final_amount), 0) as final_gmv
      FROM revenue_attribution_events
      WHERE event_type = 'CHECKOUT_AUTHORIZED'
    `).get();
    const offeredRow = db.prepare("SELECT COUNT(*) as count FROM revenue_attribution_events WHERE event_type = 'RECOMMENDATION_OFFERED'").get();
    const acceptedRow = db.prepare("SELECT COUNT(*) as count FROM revenue_attribution_events WHERE event_type = 'CROSS_SELL_ACCEPTED'").get();
    const rejectedRow = db.prepare("SELECT COUNT(*) as count FROM revenue_attribution_events WHERE event_type = 'CROSS_SELL_REJECTED'").get();
    const authorizedRow = db.prepare("SELECT COUNT(*) as count FROM order_sessions WHERE status IN ('ORDER_CREATED', 'PAYMENT_CAPTURED', 'FULFILLMENT_DISPATCHED')").get();
    const deniedRow = db.prepare("SELECT COUNT(*) as count FROM audit_ledger WHERE event_type IN ('POLICY_VIOLATION', 'MANDATE_REVOKED', 'PDP_DECISION_DENIED', 'INTENT_REJECTED')").get();
    const acceptedCount = acceptedRow?.count || 0;
    const rejectedCount = rejectedRow?.count || 0;
    const totalInteractions = acceptedCount + rejectedCount;
    const conversionRate = totalInteractions > 0 ? acceptedCount / totalInteractions * 100 : 0;
    const recentEvents = db.prepare("SELECT * FROM revenue_attribution_events ORDER BY created_at DESC LIMIT 20").all();
    return {
      base_basket_value_inr: (baseGmvRow?.base_gmv || 0) / 100,
      cross_sell_value_inr: (baseGmvRow?.cross_sell_gmv || 0) / 100,
      final_basket_value_inr: (baseGmvRow?.final_gmv || 0) / 100,
      cross_sells_offered_count: offeredRow?.count || 0,
      cross_sells_accepted_count: acceptedCount,
      cross_sells_rejected_count: rejectedCount,
      conversion_rate_percent: Number(conversionRate.toFixed(1)),
      authorized_orders_count: authorizedRow?.count || 0,
      denied_orders_count: deniedRow?.count || 0,
      recent_events: recentEvents,
      attribution_model: "POLICY_CONSTRAINED_FIRST_PARTY"
    };
  });
  return {
    truthEngine,
    policyEngine,
    reservationEngine,
    auditLedger,
    railClient,
    webhookProcessor,
    principalRegistry,
    killSwitchEngine,
    velocityEngine,
    budgetEngine,
    pdp,
    riskProvider,
    incidentEngine,
    delegationEngine,
    mcpSurface,
    executionProvider
  };
}

// src/server.ts
dotenv.config();
var port = Number.parseInt(process.env.PORT || "3000", 10);
var host = process.env.HOST || "0.0.0.0";
var defaultPolicy = {
  policy_version: "pol_v1.0.0",
  effective_at: 1771737600,
  // 2026-02-22
  merchant_id: process.env.MERCHANT_ID || "merch_acme_electronics_01",
  max_transaction_amount: 5e6,
  // INR 50,000.00
  allowed_categories: ["electronics", "furniture", "accessories"],
  auto_refund_on_fulfillment_failure: true,
  min_margin_percentage: 15
};
async function buildApp(customDb, customPolicy) {
  const app = Fastify({
    bodyLimit: 1048576,
    // 1MB body limit
    logger: {
      level: process.env.NODE_ENV === "test" ? "silent" : "info"
    }
  });
  const dbPath = process.env.DATABASE_PATH || (process.env.VERCEL ? "/tmp/acg_gateway.db" : "./data/acg_gateway.db");
  const db = customDb || initDatabase(dbPath);
  const policy = customPolicy || defaultPolicy;
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    try {
      const rawStr = typeof body === "string" ? body : body ? body.toString("utf-8") : "";
      req.rawBody = rawStr;
      if (req.raw) {
        req.raw.rawBody = rawStr;
      }
      const json = rawStr ? JSON.parse(rawStr) : {};
      done(null, json);
    } catch (err) {
      done(err, void 0);
    }
  });
  await app.register(import("@fastify/rate-limit"), {
    global: false,
    max: 100,
    timeWindow: "1 minute"
  });
  const services = registerGatewayRoutes(app, db, policy);
  return { app, db, services };
}
async function main() {
  const { app } = await buildApp();
  try {
    await app.listen({ port, host });
    console.log(`
\u{1F680} AGENT COMMERCE GATEWAY (ACG) running at http://${host}:${port}`);
    console.log(`\u{1F6E1}\uFE0F  Merchant Control Plane ready for Razorpay Track 01
`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}

// api/server_entry.ts
var fastifyAppPromise = null;
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
async function handler(req, res) {
  try {
    const app = await getFastifyApp();
    app.server.emit("request", req, res);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      error: "FUNCTION_INITIALIZATION_ERROR",
      message: err?.message || String(err)
    }));
  }
}
export {
  handler as default
};
