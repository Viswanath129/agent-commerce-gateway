# Agent2Agent (A2A) Protocol Adapter

## Specification & Normalization Boundary

* **Status:** `ADAPTER READY`
* **Version:** `2026.1-LF` (Linux Foundation standard)
* **Ingress Route:** `POST /v1/agent/ingress/a2a`

### Mechanics
Unwraps A2A JSON-RPC task messages (`a2a.commerce.proposeTransaction`). Binds sender agent DID (`did:key:z6Mku...`) to the audit trajectory and passes the embedded payload to ACG Canonical IR.
