Repository: B:\projects\RAZOR PAY- Buildathon (Remote: https://github.com/Viswanath129/agent-commerce-gateway.git)
Branch: main (ahead of origin/main by 1 commit)
Commit: 23ba7772a3bf69303930af93486970131326fd4c (chore(release): freeze repository architecture for v1.0.0-acg-rc)
Node version: v24.11.1
Package manager: npm 11.14.1
Test command: npm test (vitest run — 12 test files passed, 100 / 100 passing tests, duration ~3.69s)
Pentest command: npm run pentest (tsx src/demo/pentest_runner.ts — 19 / 19 scenarios executed and passed/blocked, raw results in reports/pentest/raw_results.json)
Benchmark command: npm run benchmark (tsx src/demo/benchmark.ts — Cold-start in-memory transaction measured at 360.35 ms; canonical reference baseline: 303.81 ms)
Audit command: npm run audit:verify (tsx scripts/verify_audit.ts — 307 blocks verified across 3 SQLite ledgers: ./data/acg_gateway.db [183 blocks], ./data/demo_simulation.db [28 blocks], ./data/live_pentest.db [96 blocks])
Build command: npm run build (tsc && vite build — TypeScript server compilation and Vite frontend bundle exit 0)
Database mode: Single-node synchronous embedded SQLite via Node.js built-in node:sqlite (DatabaseSync). Default file path ./data/acg_gateway.db (or :memory: during tests). Concurrency control via BEGIN IMMEDIATE TRANSACTION; with PRAGMA foreign_keys = ON;. WAL mode is NOT active (default rollback journal). PostgreSQL schema (src/store/postgres_schema.sql) exists as an enterprise roadmap reference but is not wired in runtime code.
Razorpay environment: Offline mock sandbox by default. Defined in .env via RAZORPAY_KEY_ID=rzp_test_placeholder_key and RAZORPAY_KEY_SECRET=rzp_test_placeholder_secret. In src/rails/razorpay.ts, isLiveCredentials evaluates to false for placeholder keys, routing order creation, refunds, and payment fetching to local deterministic mock generators rather than live network endpoints.
External credentials available: No (dummy placeholder credentials in .env: rzp_test_placeholder_key, rzp_test_placeholder_secret, rzp_webhook_secret_12345)
Production access: None (NODE_ENV=development, no live Razorpay API keys, no production database clusters, and no production infrastructure access)
Known limitations:
1. Single-Process SQLite Serialization: DatabaseSync in node:sqlite is synchronous and blocks the Node.js event loop during disk I/O. Concurrency guarantees (ACID isolation) apply strictly within a single operating system process; horizontal scaling across multiple instances requires migrating to PostgreSQL with row-level locks or Redis Redlock.
2. Offline Mock Fallback: Because placeholder test credentials are used, runtime execution does not perform live network calls to Razorpay's sandbox endpoints (https://api.razorpay.com/v1/*). Live API error handling and network latency are not exercised by default runs.
3. Working Tree State: Working tree contains uncommitted modifications to reports/pentest/raw_results.json, src/gateway/router.ts, and src/store/db.ts, as well as untracked files (docs/evolution/, src/core/__tests__/v2_control_plane.test.ts, src/core/__tests__/v3_security_infra.test.ts, src/core/__tests__/v4_universal_plane.test.ts, and core V2/V3/V4 plane modules).
4. Test Suite Expansion: Repository documentation (AGENTS.md) documents 77 tests; active test execution reveals 100 tests (100 / 100 passing) due to the presence of uncommitted test suites for V2 control plane, V3 security infra, and V4 universal plane.
5. Benchmark Scope: Benchmark evaluates cold-start gateway initialization and in-memory injection (app.inject), not external network roundtrips.
6. Experimental Runtime Warning: Node.js emits ExperimentalWarning: SQLite is an experimental feature and might change at any time during execution of node:sqlite.
