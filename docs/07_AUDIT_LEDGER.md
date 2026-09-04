# ACG Tamper-Evident SHA-256 Audit Ledger

## Cryptographic Provenance & Forward Hash Chaining

---

## 1. Hash Chain Mathematical Specification

Each audit block $B_i$ is bound cryptographically to the preceding block hash $H_{i-1}$ and the canonical serialized event payload:

$$H_i = \text{SHA256}(\text{audit\_id} \parallel \text{intent\_id} \parallel \text{timestamp} \parallel \text{event\_type} \parallel \text{prev\_state} \parallel \text{new\_state} \parallel \text{details\_json} \parallel H_{i-1})$$

For the initial genesis block:
$$H_0 = \text{"GENESIS\_BLOCK\_0000000000000000"}$$

---

## 2. Tamper Detection Guarantees

If an attacker, rogue process, or database administrator modifies any field in an existing record, inserts an unauthorized block, deletes an entry, or reorders records:
1. The recomputed hash $H_k$ will differ from the recorded `record_hash`.
2. The subsequent block's `previous_record_hash` will fail forward linking.
3. The verification routine aborts immediately with a specific block mismatch error.

---

## 3. Clean-State Verification Command

To verify all audit ledger chains across all stored databases:

```bash
npm run audit:verify
```

### Verified Clean-State Output:
* `data/acg_gateway.db`: **183 blocks verified**
* `data/demo_simulation.db`: **28 blocks verified**
* `data/live_pentest.db`: **96 blocks verified**
* **Total Cryptographically Verified Blocks:** **307 blocks** (0 broken links, 0 tampered hashes).
