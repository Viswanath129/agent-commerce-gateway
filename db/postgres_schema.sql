-- Agent Commerce Gateway (ACG) — Production PostgreSQL DDL
-- ACID Dual-Resource Reservation & Tamper-Evident SHA-256 Chained Ledger

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Authoritative Merchant Catalog
CREATE TABLE IF NOT EXISTS catalog_items (
    sku VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,
    unit_price BIGINT NOT NULL, -- in paise
    tax_rate_bps INT NOT NULL DEFAULT 1800, -- 18.00%
    available_stock INT NOT NULL DEFAULT 0 CHECK (available_stock >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Buyer Mandate Ledger & Real-Time Spend Tracking
CREATE TABLE IF NOT EXISTS buyer_mandates (
    mandate_id VARCHAR(128) PRIMARY KEY,
    principal_public_key VARCHAR(128) NOT NULL,
    budget_limit BIGINT NOT NULL CHECK (budget_limit >= 0),
    spent_amount BIGINT NOT NULL DEFAULT 0 CHECK (spent_amount >= 0),
    reserved_amount BIGINT NOT NULL DEFAULT 0 CHECK (reserved_amount >= 0),
    currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    merchant_whitelist JSONB,
    category_whitelist JSONB,
    expiry BIGINT NOT NULL,
    signature TEXT,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mandates_pubkey ON buyer_mandates(principal_public_key);

-- 3. Principal Mandate Revocations
CREATE TABLE IF NOT EXISTS revoked_mandates (
    mandate_id VARCHAR(128) PRIMARY KEY,
    revocation_reason TEXT NOT NULL,
    revoked_at BIGINT NOT NULL,
    revocation_signature TEXT
);

-- 4. Dual-Resource ACID Reservations (Budget + Inventory Locks)
CREATE TABLE IF NOT EXISTS reservations (
    reservation_id VARCHAR(128) PRIMARY KEY,
    intent_id VARCHAR(128) NOT NULL UNIQUE,
    mandate_id VARCHAR(128) NOT NULL REFERENCES buyer_mandates(mandate_id),
    total_paise BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'HELD' CHECK (status IN ('HELD', 'COMMITTED', 'RELEASED', 'EXPIRED')),
    expires_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);

-- 5. Reservation Line Items
CREATE TABLE IF NOT EXISTS reservation_items (
    id SERIAL PRIMARY KEY,
    reservation_id VARCHAR(128) NOT NULL REFERENCES reservations(reservation_id) ON DELETE CASCADE,
    sku VARCHAR(64) NOT NULL REFERENCES catalog_items(sku),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price BIGINT NOT NULL,
    tax_amount BIGINT NOT NULL
);

-- 6. Order Sessions & Razorpay Rail Linkage
CREATE TABLE IF NOT EXISTS order_sessions (
    intent_id VARCHAR(128) PRIMARY KEY,
    receipt VARCHAR(128) NOT NULL UNIQUE,
    razorpay_order_id VARCHAR(128) NOT NULL UNIQUE,
    razorpay_payment_id VARCHAR(128),
    amount BIGINT NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    status VARCHAR(64) NOT NULL DEFAULT 'ORDER_CREATED',
    reservation_id VARCHAR(128) REFERENCES reservations(reservation_id),
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- 7. Tamper-Evident SHA-256 Backwards-Chained Audit Ledger
CREATE TABLE IF NOT EXISTS audit_ledger (
    block_index BIGSERIAL PRIMARY KEY,
    intent_id VARCHAR(128) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    from_state VARCHAR(64) NOT NULL,
    to_state VARCHAR(64) NOT NULL,
    payload_json JSONB NOT NULL,
    prev_block_hash VARCHAR(64) NOT NULL,
    block_hash VARCHAR(64) NOT NULL UNIQUE,
    timestamp BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_intent ON audit_ledger(intent_id);

-- 8. Razorpay Webhook Event Deduplication
CREATE TABLE IF NOT EXISTS processed_webhook_events (
    event_id VARCHAR(128) PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    processed_at BIGINT NOT NULL,
    payload_json JSONB NOT NULL
);

-- 9. Revenue Attribution Events
CREATE TABLE IF NOT EXISTS revenue_attribution_events (
    attribution_id VARCHAR(128) PRIMARY KEY,
    intent_id VARCHAR(128) NOT NULL,
    session_id VARCHAR(128) NOT NULL,
    primary_sku VARCHAR(64) NOT NULL,
    recommended_sku VARCHAR(64) NOT NULL,
    action VARCHAR(32) NOT NULL,
    uplift_paise BIGINT NOT NULL,
    timestamp BIGINT NOT NULL
);
