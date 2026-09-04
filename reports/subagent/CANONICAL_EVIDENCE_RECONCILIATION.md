# CANONICAL EVIDENCE RECONCILIATION

## TESTS:
old: 77/77 tests (9 test suites)
previous: 102/102 tests (12 test files)
current & canonical: 110/110 tests (13 test files). Expanded organically via V2/V3/V4 control plane additions and the dedicated `remediation_sprint.test.ts` suite verifying all 8 Critical and High security fixes.

## PENTEST:
canonical: 19/19 Live Adversarial Tests Blocked/Passed.

## AUDIT:
canonical: 271 Verified Cryptographically Chained Blocks across 3 SQLite databases.

## RAZORPAY:
actual environment: Offline Mock Sandbox by default (controlled via `!this.isLiveCredentials` flag in `razorpay.ts`).
actual verification level: Razorpay integration contract / local sandbox harness verified. (No actual network request to live/sandbox Razorpay servers occurred).

## BENCHMARK:
old: 303.81 ms
current: 397.43 ms (Cold-Start In-Memory Internal Processing)
canonical: 397.43 ms (Measures gateway boot, policy engine, catalog ingestion, Ed25519 mandate signing, and 6-phase checkout up to local mock creation; this does not measure network latency to Razorpay).

## DATABASE:
current: node:sqlite DatabaseSync, single-node, standard rollback journal (WAL NOT ACTIVE).
verified guarantees: Single-node ACID compliant atomic dual-resource reservations.
production limitation: Lacks horizontal scalability and concurrent writer throughput due to SQLite global database locking.

## BUILD:
current: Clean (npm run build succeeds with 0 errors).

## FRONTEND:
current: Live verification intact with frontend enforcing 401/403 UI barriers on API failures.

============================================================
EVIDENCE CONSISTENT & FULLY RECONCILED
============================================================
