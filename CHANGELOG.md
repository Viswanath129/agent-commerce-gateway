# Changelog

All notable changes to the Agent Commerce Gateway (ACG / MACCP) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]
- Added a Vercel same-origin Fastify adapter and explicit non-durable
  `VERCEL_DEMO=1` guard; Vercel is not represented as production financial
  persistence.
- Removed browser-build merchant-token configuration. Dashboard credentials are
  supplied by the operator at runtime and retained only for the browser session.
- Added Vercel deployment, security, persistence, and verification
  documentation without claiming an undeployed URL.
- Distributed PostgreSQL persistence and Redis Redlock cluster coordination (production roadmap).
- Hardware Security Module (KMS / Vault) key management integration.

---

## [1.1.0-rc] — 2026-09-04
### Fixed & Hardened (Security Remediation Sprint)
- **CRITICAL 1 — Authorization Bypass on `/v1/reservations`:** Bound reservation holding to authenticated control-plane scopes, eliminating untrusted resource decrements.
- **CRITICAL 2 — Mandate Re-Registration Budget Reset:** Preserved decremented `remaining_budget` on active mandates (`HTTP 409 MANDATE_ALREADY_EXISTS`).
- **CRITICAL 3 — Webhook `mock_signature` Backdoor Removal:** Eradicated test short-circuit; enforced authentic cryptographic HMAC-SHA256 on all webhook ingress.
- **HIGH 4 — Unified PDP Control Plane Ingress:** Consolidated live checkout through full agent identity verification, capability validation, and human confirmation thresholds.
- **HIGH 5 — Protected Confirmation Endpoint:** Secured `/v1/confirm` with RBAC authorization, agent/mandate binding, and one-time execution semantics.
- **HIGH 6 — Webhook Financial State Machine Enforcement:** Routed all webhook mutations through `FinancialStateMachine`, forbidding delayed capture on released/failed sessions.
- **HIGH 7 — Raw Wire HMAC-SHA256 Verification:** Captured unmodified Fastify raw body bytes to prevent JSON re-serialization discrepancy exploits.
- **HIGH 8 — Static Admin Token Remediation:** Eradicated hardcoded admin credentials from production paths in favor of environment-injected secrets.

### Added
- **Dedicated Remediation Regression Suite:** 8 new regression tests in [`src/core/__tests__/remediation_sprint.test.ts`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/__tests__/remediation_sprint.test.ts), bringing test coverage to 110 / 110 tests across 13 test files.
- **Exploit Replay Verification:** Verified 8/8 closed findings in [`reports/security/FINAL_REMEDIATION_REPORT.md`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/reports/security/FINAL_REMEDIATION_REPORT.md).

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
