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

    -- 7. Non-Repudiable Cryptographic Audit Ledger
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
  `);

  return db;
}
