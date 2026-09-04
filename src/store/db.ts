import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

export type SqliteDatabase = DatabaseSync;

export function initDatabase(dbPath: string = "./data/acg_gateway.db"): DatabaseSync {
  if (dbPath !== ":memory:") {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(dbPath);

  // Enable foreign keys
  db.exec("PRAGMA foreign_keys = ON;");

  // Run initial schema migrations
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
