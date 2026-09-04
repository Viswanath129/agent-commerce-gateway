# ACG Troubleshooting & Diagnostics

## Common Operational Scenarios & Resolutions

---

## 1. Diagnostics Checklist

1. **401 INVALID_MANDATE_SIGNATURE:**
   * Verify public key matches private key used to sign mandate payload.
   * Ensure mandate fields are sorted canonically via `getCanonicalMandateBytes`.
2. **403 MANDATE_REVOKED:**
   * The human principal issued a revocation via `/v1/mandates/revoke`. The mandate cannot be reused.
3. **409 DUPLICATE_INTENT_REPLAY:**
   * Each checkout intent requires a unique `intent_id` (UUID v4).
4. **Audit Chain Tamper Detected:**
   * Run `npm run audit:verify` to inspect individual block hash linkages.
