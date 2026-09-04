# Webhook Security & Ingress Hardening

## HMAC Validation and Event Deduplication

---

## 1. Webhook Signature Verification

* **Header:** `x-razorpay-signature`
* **Algorithm:** Constant-time HMAC SHA-256 (`crypto.timingSafeEqual`).
* **Secret Storage:** `RAZORPAY_WEBHOOK_SECRET` environment variable.
* **Failure Outcome:** `HTTP 401 INVALID_WEBHOOK_SIGNATURE`.

---

## 2. Event Deduplication

* **Header:** `x-razorpay-event-id`
* **Mechanism:** Query `processed_webhook_events` before state mutation.
* **Outcome on Duplicate:** `HTTP 200 DUPLICATE_IGNORED` with zero duplicate side effects.
