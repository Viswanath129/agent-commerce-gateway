# Concurrency Warfare & Double-Spend Defense

## Dual-Resource Locking and Invariant Guarantees

---

## 1. Concurrency as a Security Perimeter

In multi-agent architectures, agents spawn concurrently and may attempt to exhaust remaining funds simultaneously. ACG prevents double-spending by acquiring dual locks on both mandate budget paise and catalog unit stock within a single serialized transaction.

---

## 2. Invariant Proofs

Under 10-agent race conditions against a residual budget of ₹2,876.00:
* **Allowed:** Exactly 1 subagent (HTTP 201).
* **Blocked:** Exactly 9 subagents (HTTP 409).
* **Ending Budget:** ₹752.00 ($\ge 0$).
* **Ending Stock:** Correct decrement ($\ge 0$).

---

## 3. Scope Boundary

* **Verified Now:** Serialized single-node SQLite atomicity (`BEGIN IMMEDIATE`).
* **Production Target:** Distributed locking via PostgreSQL row-level locks and Redis Redlock.
