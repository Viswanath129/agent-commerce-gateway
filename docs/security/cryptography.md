# Cryptographic Assurance & Mandate Verification

## Ed25519 Canonicalization and Proofs

---

## 1. Canonical Serialization

To guarantee mathematical determinism across heterogeneous programming languages and JSON parsers, mandate fields are normalized into a sorted canonical object before hashing and signing:

```typescript
export function getCanonicalMandateBytes(mandate: Omit<BuyerMandate, "signature">): Buffer {
  const canonicalObject = {
    mandate_id: mandate.mandate_id,
    principal_public_key: mandate.principal_public_key,
    budget_limit: mandate.budget_limit,
    currency: mandate.currency,
    merchant_whitelist: mandate.merchant_whitelist ? [...mandate.merchant_whitelist].sort() : undefined,
    category_whitelist: mandate.category_whitelist ? [...mandate.category_whitelist].sort() : undefined,
    expiry: mandate.expiry,
  };
  return Buffer.from(JSON.stringify(canonicalObject));
}
```

---

## 2. Cryptographic Negative Tests

* **Bit Flip:** Corrupting a single hex character in the signature returns `HTTP 401 INVALID_MANDATE_SIGNATURE`.
* **Public Key Substitution:** Substituting a different public key fails verification (`HTTP 401`).
* **Budget Tampering:** Modifying `budget_limit` post-signature fails verification (`HTTP 401`).
* **Expiry Tampering:** Altering the `expiry` timestamp fails verification (`HTTP 401`).
