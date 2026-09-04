# Protocol Compatibility & Normalization Matrix

## Multi-Agent Ecosystem Interoperability

---

## 1. Classification & Status Vocabulary

* **`LIVE`**: Fully active, end-to-end execution path verified against real settlement rails.
* **`ADAPTER READY`**: Protocol normalization parser implemented and verified against ACG Canonical IR.
* **`ARCHITECTURE READY / ADVISORY`**: Interface contract modeled for upstream/downstream advisory signals.
* **`DESIGN`**: Architectural specification complete; awaiting industry ratification.

---

## 2. Comprehensive Compatibility Matrix

| Protocol | Status | Version | Input Format | Canonical IR Mapping | Auth Mechanism | Limitation / Scope |
| :--- | :---: | :---: | :--- | :--- | :--- | :--- |
| **Native ACG** | **`LIVE`** | `v1.0.0` | Canonical Intent JSON | Direct 1:1 Schema Mapping | Ed25519 Mandate Signature | Reference protocol |
| **REST Ingress** | **`LIVE`** | `v1.0.0` | Standard HTTP JSON | Direct Canonical Mapping | Scoped Bearer Tokens | HTTP POST ingress |
| **Razorpay Sandbox** | **`LIVE`** | `v1` | Razorpay Orders API | Downstream Order Payload | Basic Auth API Keys | Sandbox environment |
| **Model Context Protocol (MCP)** | **`ADAPTER READY`** | `2024-11-05` | JSON-RPC `tools/call` | Extracts `acg_checkout` args | Ed25519 in arguments | HTTP transport; stdio via bridge |
| **Agent2Agent Protocol (A2A)** | **`ADAPTER READY`** | `2026.1-LF` | A2A Task Message | Unwraps task payload | DID + Ed25519 Mandate | Linux Foundation spec |
| **Agentic Commerce Protocol (ACP)** | **`ADAPTER READY`** | `acp/1.0` | Cart & Order Envelope | Maps line items & principal | Delegated Mandate | Open envelope standard |
| **Agent Payments Protocol (AP2)** | **`ADAPTER READY`** | `v0.2.0` | AP2 Container | Maps AP2 cart to ACG IR | Authorization Container | Authorization envelope |
| **Universal Commerce Protocol (UCP)**| **`ADAPTER READY`** | `ucp-v1.2` | Assistant Journey Request | Maps `order_lines` to catalog | Delegated Mandate | Journey checkout format |
| **Visa Trusted Agent Protocol (TAP)**| **`DESIGN`** | `tap/1.0-draft`| Hardware Attestation Container| Maps TEE token & items | Enclave Hardware Attestation | Specification stage |
| **Razorpay Vulcan Intelligence** | **`ARCHITECTURE READY`** | `vulcan-v1.4` | Transaction Context | Advisory routing hints | Non-authoritative Advisory | Downstream intelligence only |
