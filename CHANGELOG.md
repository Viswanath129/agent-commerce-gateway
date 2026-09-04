# Changelog

All notable changes to the Agent Commerce Gateway (ACG / MACCP) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]
- Distributed PostgreSQL persistence and Redis Redlock cluster coordination (production roadmap).
- Hardware Security Module (KMS / Vault) key management integration.

---

## [1.0.0-rc] — 2026-09-03
### Added
- **Core Authorization Pipeline:** 6-phase zero-trust gateway enforcing Ed25519 buyer authority, SQLite catalog truth, dynamic policy evaluation, and atomic dual-resource reservation.
- **Protocol Normalization Adapters:** Direct support for Native ACG, REST Ingress, MCP (`tools/call`), A2A, ACP, AP2, UCP, and Visa TAP design.
- **Razorpay Core Settlement Rail:** Idempotent order creation (`receipt = intent_id`), constant-time HMAC SHA-256 webhook validation, and capture-gated idempotent refunds.
- **High-Concurrency Dual Locking:** ACID transaction boundaries preventing double-spending across 10-agent race conditions.
- **Tamper-Evident SHA-256 Audit Ledger:** Forward-chained block audit trail with instant tamper detection (`npm run audit:verify`).
- **Comprehensive Test Suite:** 77 automated vitest tests across 9 test files, with 100% pass rate.
- **Live Penetration Suite:** 19 adversarial HTTP test scenarios with 100% defense verification.
- **Evaluator Evidence & PDF Package:** 11 standardized evidence documents and consolidated master PDF.
