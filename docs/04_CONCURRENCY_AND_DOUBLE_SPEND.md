# ACG Concurrency & Double-Spend Defense

## Mathematical Boundaries & Single-Node Atomicity

---

## 1. Concurrency as a Primary Financial Boundary

In an ecosystem where autonomous subagents spawn in parallel, concurrent execution is not merely a performance consideration—it is a critical financial security boundary. Without atomic dual-locking, parallel agents could double-spend delegated budget or oversell scarce merchant inventory.

---

## 2. Empirical 10-Agent Race Evidence

In live high-concurrency load testing (`npm run pentest` scenario `CONCUR-01`):
* **Initial State:** Mandate remaining budget = ₹2,876.00; Cart total per agent = ₹2,124.00.
* **Concurrent Load:** 10 parallel subagents concurrently submit checkout requests.
* **Observed Result:**
  * **Allowed Checkouts:** Exactly **1 subagent** succeeded (`HTTP 201 Created`).
  * **Blocked Overspends:** Exactly **9 subagents** were rejected (`HTTP 409 Conflict`).
  * **Final Mandate Balance:** Exactly ₹752.00 ($\ge 0$).
  * **Final Inventory Units:** Exactly 1 unit decremented ($\ge 0$).
  * **Duplicate Orders:** **0**.

---

## 3. Single-Node Architecture & Scope Disclosure

> **Architectural Scope Notice:**  
> The current reference implementation achieves serialized transaction atomicity on a single node using SQLite `BEGIN IMMEDIATE TRANSACTION`.  
>  
> **Production Target:** Multi-instance distributed deployments require migration to PostgreSQL row-level locks (`SELECT ... FOR UPDATE`) paired with Redis Redlock distributed coordination.
