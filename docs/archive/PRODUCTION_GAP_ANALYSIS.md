# ACG Production Gap Analysis & Scaling Roadmap

## Controlled Sandbox vs Enterprise Production Architecture

This document explicitly distinguishes between the features **VERIFIED NOW** in the single-node reference implementation and the **PRODUCTION TARGET** architecture required for planetary-scale multi-merchant deployment.

---

## 1. Direct Architecture Comparison

| Architectural Dimension | VERIFIED NOW (Sandbox & Buildathon) | PRODUCTION TARGET (Enterprise Scale) |
| :--- | :--- | :--- |
| **Persistence Engine** | Node.js `node:sqlite` Single-Node ACID | PostgreSQL 16+ with Row-Level Locking & Read Replicas |
| **Concurrency Control** | In-Process SQLite `BEGIN IMMEDIATE TRANSACTION` | Distributed Redlock (Redis) / Postgres Advisory Locks |
| **Event Outbox & Workers** | Synchronous In-Process Handlers | Distributed RabbitMQ / Kafka / Temporal Outbox Workflows |
| **API Authentication** | Bearer Token Scope Guard (`requireScope`) | OIDC / OAuth 2.0 / JWT Claims / BFF HttpOnly Cookies |
| **Secret Storage** | `.env` Configuration File | AWS Secrets Manager / HashiCorp Vault |
| **Ledger Storage** | Chained SQLite Table with SHA-256 Hashes | Append-Only WORM Storage (AWS QLDB or S3 Object Lock) |
| **High Availability** | Single Node Instance | Multi-AZ Kubernetes Cluster with Auto-Scaling Pods |
| **Observability** | Structured Fastify Logging + Audit Trajectory API | OpenTelemetry Traces + Prometheus Metrics + Grafana |

---

## 2. Verified Invariants (What Works Today)

1. **Deterministic Single-Node Concurrency:** Guaranteed atomicity for single-instance deployments using serialized SQLite transactions.
2. **Cryptographic Mandate Authority:** Full Ed25519 signature verification on canonical payloads.
3. **Commerce Truth Enforcement:** Absolute isolation of merchant pricing and catalog data from agent hallucination.
4. **Idempotent Webhook Processing:** Deterministic event deduplication via database event logs.
5. **Fail-Closed Rail Behavior:** Immediate rollback of dual-resource reservations if downstream order creation fails.

---

## 3. Production Migration Roadmap

### Phase 1: PostgreSQL & Transactional Migration
* Migrate schema from `store/db.ts` to `store/postgres_schema.sql`.
* Implement `SELECT ... FOR UPDATE` row-level locks on `catalog_items` and `buyer_mandates`.

### Phase 2: Distributed Locking & Outbox Pattern
* Deploy Redis Cluster with Redlock algorithm for distributed coordination across multiple gateway pods.
* Implement transactional outbox table for resilient asynchronous webhook dispatch and fulfillment tracking.

### Phase 3: Enterprise Auth & Key Management
* Replace static bearer tokens with OAuth 2.0 / OIDC tokens issued by identity providers (Auth0 / Okta).
* Integrate AWS KMS or HashiCorp Vault for signing key storage and rotation.
