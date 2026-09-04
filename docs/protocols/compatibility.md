# Multi-Protocol Normalization & Compatibility Matrix

## Agent Ecosystem Interoperability

---

## 1. Classification & Status

* **`LIVE`**: Native ACG, REST Ingress, Razorpay Sandbox API.
* **`ADAPTER READY`**: MCP (`tools/call`), A2A, ACP, AP2, UCP.
* **`DESIGN`**: Visa TAP (Hardware Enclaves).
* **`ARCHITECTURE READY / ADVISORY`**: Razorpay Vulcan Intelligence.

---

## 2. Summary Matrix

| Protocol | Status | Normalization Boundary | Auth Primitive |
| :--- | :---: | :--- | :--- |
| **Native ACG** | **`LIVE`** | Direct Canonical Mapping | Ed25519 Mandate Signature |
| **REST Ingress** | **`LIVE`** | Standard JSON Ingress | Bearer Token Scopes |
| **Razorpay Sandbox** | **`LIVE`** | Order & Webhook Rails | Basic Auth / HMAC SHA-256 |
| **Model Context Protocol** | **`ADAPTER READY`** | Maps `tools/call` arguments | Ed25519 in arguments |
| **Agent2Agent Protocol** | **`ADAPTER READY`** | Unwraps task message payload | DID + Ed25519 Mandate |
| **Agentic Commerce Protocol** | **`ADAPTER READY`** | Maps cart & buyer principal | Delegated Mandate |
| **Agent Payments Protocol** | **`ADAPTER READY`** | Maps AP2 cart to ACG IR | Authorization Container |
| **Universal Commerce Protocol**| **`ADAPTER READY`** | Maps `order_lines` to catalog | Delegated Mandate |
| **Visa Trusted Agent Protocol**| **`DESIGN`** | Hardware Attestation container | TEE Attestation Token |
| **Razorpay Vulcan** | **`ARCHITECTURE READY`** | Downstream routing hints | Non-authoritative Advisory |
