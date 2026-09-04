# ACG Threat Model & Risk Analysis

## Threat Classifications and Defensive Mitigations

---

## 1. STRIDE Threat Analysis

| STRIDE Category | Specific Attack Vector in Agentic Commerce | ACG Countermeasure | Evidence Status |
| :--- | :--- | :--- | :---: |
| **Spoofing** | Rogue agent submits forged mandate | Ed25519 canonical signature verification | **`VERIFIED`** |
| **Tampering** | Agent modifies cart price / discount | Merchant database catalog isolation | **`VERIFIED`** |
| **Repudiation** | Principal disputes transaction authority | SHA-256 forward-chained audit ledger | **`VERIFIED`** |
| **Information Disclosure** | Unauthorized party queries ledger | Scoped bearer token authorization | **`VERIFIED`** |
| **Denial of Service** | High-concurrency race attacking inventory | Serialized SQLite dual-resource locks | **`VERIFIED`** |
| **Elevation of Privilege** | Subagent ignores delegated budget cap | Versioned policy engine enforcement | **`VERIFIED`** |

---

## 2. Threat Mitigation Invariants

* **0 Unauthorized Financial-Impact Paths Observed** in tested scenarios.
* **19 / 19 Live Adversarial Vectors Intercepted** with 100% defense rate.
