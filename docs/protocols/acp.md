# Agentic Commerce Protocol (ACP) & AP2 & UCP & Visa TAP

## Protocol Adapter Specifications

---

## 1. Agentic Commerce Protocol (ACP)
* **Status:** `ADAPTER READY`
* **Route:** `POST /v1/agent/ingress/acp`
* **Mechanics:** Extracts cart line items, session nonce, buyer principal ID, and delegated commerce mandate into ACG Canonical IR.

---

## 2. Agent Payments Protocol (AP2)
* **Status:** `ADAPTER READY`
* **Route:** `POST /v1/agent/ingress/ap2`
* **Mechanics:** Maps AP2 payment intent, payer principal, authorization mandate container, and cart items to ACG Canonical IR.

---

## 3. Universal Commerce Protocol (UCP)
* **Status:** `ADAPTER READY`
* **Route:** `POST /v1/agent/ingress/ucp`
* **Mechanics:** Resolves assistant checkout requests, extracts `order_lines` (SKU, title, quantity), and passes delegated mandate to ACG.

---

## 4. Visa Trusted Agent Protocol (TAP)
* **Status:** `DESIGN`
* **Route:** `POST /v1/agent/ingress/tap`
* **Mechanics:** Attestation container design evaluating hardware TEE attestation tokens and agent reputation tiers.
