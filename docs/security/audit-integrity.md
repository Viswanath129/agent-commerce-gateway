# Audit Ledger Integrity & Hash Chaining

## Cryptographic Provenance & Tamper Detection

---

## 1. Mathematical Structure

Each block $B_i$ contains:
$$H_i = \text{SHA256}(\text{audit\_id} \parallel \text{intent\_id} \parallel \text{timestamp} \parallel \text{event\_type} \parallel \text{prev\_state} \parallel \text{new\_state} \parallel \text{details\_json} \parallel H_{i-1})$$

---

## 2. Verification Verification

* Verification script: `npm run audit:verify`
* Clean-state result: **307 blocks verified across all database instances**.
* Tamper detection: Artificially mutated rows trigger immediate verification failure.
