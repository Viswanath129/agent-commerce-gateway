# ACG — DASHBOARD SECURITY & DATA INTEGRITY ASSESSMENT

**Target:** Agent Commerce Gateway (ACG) Web Dashboard (`public/index.html`)  
**Assessment Date:** August 22, 2026  
**Security Model:** Zero-Trust Frontend / Backend Authoritative State  

---

## 1. Threat Model & Security Posture

| Threat Scenario | Attack Vector | Gateway Defense Mechanism | Verdict |
| :--- | :--- | :--- | :---: |
| **Frontend Parameter Tampering** | Attacker modifies DOM input to fake ₹1.00 payment or alter budget cap | Backend ignores client price completely; re-queries SQLite catalog directly | **PREVENTED** |
| **Direct API Bypass** | Attacker sends raw HTTP `POST /v1/agent/checkout` omitting UI checks | All 7 deterministic defense layers (Zod $\rightarrow$ Ed25519 $\rightarrow$ Catalog Truth $\rightarrow$ Policy $\rightarrow$ ACID Reservation $\rightarrow$ Rail) are enforced inside Fastify router | **PREVENTED** |
| **Stored XSS Injection in Ledger** | Malicious agent submits `<script>alert(1)</script>` in `intent_id` or SKU name | DOM text injection uses `innerText` and standard template string escapings; no `eval` or unsafe HTML rendering | **PREVENTED** |
| **Secret Exposure** | Client dashboard attempts to dump Razorpay API Key Secret | API Keys exist only in backend `.env` / memory; `/dashboard/*` endpoints never serialize secrets | **PREVENTED** |
| **State Forgery in Demo Mode** | Attacker attempts to fake a successful transaction locally | Real database state is queried by poller; uncommitted transactions never persist or increment KPIs | **PREVENTED** |
| **Cross-Origin Abuse (CORS/CSRF)** | Malicious third-party origin tries to fire checkout requests | Local binding (`127.0.0.1:3000`) and Fastify request validation prevent unauthorized cross-origin execution | **PREVENTED** |

---

## 2. Core Architectural Verdict

> **"The frontend has zero authorization rights. The backend is the sole source of truth."**  
> Even if an adversary completely compromises or modifies the client browser runtime, every transaction must satisfy cryptographic Ed25519 signature checks, database pricing truth, merchant policy versioning, and SQLite ACID locks on the server before Razorpay rails can ever be invoked.
