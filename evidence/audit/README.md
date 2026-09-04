# Cryptographic Audit Ledger Evidence

## Verification Artifact

* **What was tested:** Cryptographic SHA-256 forward-chain integrity across all persistent SQLite database instances.
* **How it was tested:** `scripts/verify_audit.ts` computing $H_i = \text{SHA256}(payload \parallel H_{i-1})$ for every stored block.
* **When it was tested:** September 3, 2026.
* **Reproduction Command:** `npm run audit:verify`
* **Expected Result:** Valid hash chain across all database instances; detection of any altered bytes.
* **Observed Result:** **307 blocks cryptographically verified** across `acg_gateway.db` (183), `demo_simulation.db` (28), and `live_pentest.db` (96). Zero broken links.
