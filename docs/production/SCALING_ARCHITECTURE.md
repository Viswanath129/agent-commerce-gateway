# Production Scaling Architecture

## Current Implementation: Single-Node SQLite
The current implementation of the Agent Commerce Gateway (ACG) uses a single-node architecture backed by SQLite (`node:sqlite`). 

### Verified Environment
- The single-node environment has been rigorously tested for correctness.
- Concurrent requests using `BEGIN IMMEDIATE TRANSACTION` guarantee that double-spending and race conditions are impossible at the database level.
- **Single-Node Concurrency Invariant:** The synchronous nature of `DatabaseSync` ensures strict serializability for reservations.

### Limitations
- The `DatabaseSync` driver blocks the Node.js event loop during transaction execution.
- Under heavy concurrent load, this leads to request starvation, where health checks, webhooks, and dashboard API requests are queued behind database locks.
- This architecture cannot scale horizontally (to multiple ACG nodes) because SQLite locks are local to the filesystem.

---

## Production Target Architecture: PostgreSQL & Asynchronous I/O

For a true production deployment across multiple instances, the architecture must transition from local synchronous SQLite to a distributed asynchronous model.

### 1. Database: PostgreSQL
- **Migration:** Replace `node:sqlite` with PostgreSQL.
- **Driver:** Use an asynchronous driver (e.g., `pg`) with a connection pool.
- **Transactions:** Maintain the ACID reservation properties using Postgres row-level locks (`SELECT ... FOR UPDATE`) instead of global database locks. This allows non-overlapping inventory reservations to process concurrently.

### 2. Horizontal Scaling (Multiple ACG Nodes)
- With PostgreSQL handling concurrent locks, ACG nodes can be horizontally scaled behind a load balancer.
- Stateless HTTP handlers ensure that any incoming agent request or Razorpay webhook can be processed by any node.

### 3. Queue / Outbox Pattern (Optional)
- For extreme scale, webhooks and post-capture fulfillment triggers can be placed on a reliable message queue (e.g., Redis, Kafka, or AWS SQS).
- This decouples the synchronous Razorpay API confirmation from the downstream merchant inventory fulfillment systems.

## Conclusion
Do not deploy the single-node SQLite architecture to a multi-instance production environment. The current implementation is strictly intended for demonstration, sandboxed testing, and environments where high-concurrency event-loop blocking is acceptable. For production, migrate to PostgreSQL and an asynchronous connection pool.
