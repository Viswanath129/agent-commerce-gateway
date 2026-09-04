# Model Context Protocol (MCP) Adapter

## Specification & Normalization Boundary

* **Status:** `ADAPTER READY`
* **Version:** `2024-11-05`
* **Ingress Route:** `POST /v1/agent/ingress/mcp`

### Mechanics
Normalizes standard MCP JSON-RPC `tools/call` invocations where tool name is `acg_checkout` or `razorpay_agentic_checkout`. Extracts tool arguments, generates cryptographic payload hash, and maps items to ACG Canonical IR.
