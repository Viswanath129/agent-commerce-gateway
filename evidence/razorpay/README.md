# Razorpay Financial Rail Evidence

## Verification Artifact

* **What was tested:** Idempotent order creation (`receipt = intent_id`), constant-time HMAC SHA-256 webhook validation, event-id deduplication, and capture-gated idempotent refunds.
* **How it was tested:** `src/core/__tests__/adversarial_suite.test.ts` and `src/demo/pentest_runner.ts` using verified sandbox contracts.
* **When it was tested:** September 3, 2026.
* **Reproduction Command:** `npx vitest run src/core/__tests__/adversarial_suite.test.ts`
* **Expected Result:** Razorpay orders bound to intent receipt; duplicate webhooks ignored without mutating status; pre-capture refunds blocked.
* **Observed Result:** **PASS** across all order, webhook, and refund lifecycle tests.
