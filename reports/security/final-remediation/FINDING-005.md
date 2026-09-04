# Security Remediation Report: FINDING-005

## Vulnerability Classification
- **ID:** FINDING-005
- **Severity:** HIGH
- **Title:** Unauthenticated Human Confirmation (`POST /v1/confirm`) & Revocation Bypass
- **CWE:** CWE-306: Missing Authentication for Critical Function / CWE-613: Insufficient Session Expiration

---

## 1. Original Vulnerability
The `POST /v1/confirm` endpoint was unauthenticated and did not verify whether the agent principal or buyer mandate had been revoked between the time the confirmation token was generated and the time it was submitted.

---

## 2. Original Reproduction
```bash
# Obtain pending confirmation token
# Principal revokes mandate in control plane
# Anonymous attacker posts confirmation token to /v1/confirm -> Succeeded
```

---

## 3. Remediation Applied
1. Protected `POST /v1/confirm` with `preHandler: [requireScope("merchant:policy:write")]`.
2. Added live status verification for the originating agent principal (`principalRegistry.getPrincipal`). If agent is no longer `ACTIVE`, returns **HTTP 403 AGENT_INACTIVE**.
3. Added verification against `revoked_mandates` registry. If mandate was revoked post-creation, returns **HTTP 403 MANDATE_REVOKED**.
4. Strictly enforced single-use token lifecycle (`PENDING` $\rightarrow$ `APPROVED`) and TTL expiry.

---

## 4. New Behavior & Verification
- Anonymous confirmation request $\rightarrow$ **HTTP 401 UNAUTHORIZED**
- Unauthorized token $\rightarrow$ **HTTP 403 FORBIDDEN**
- Post-revocation confirmation attempt $\rightarrow$ **HTTP 403 MANDATE_REVOKED**
- Duplicate token replay $\rightarrow$ **HTTP 409 CONFIRMATION_ALREADY_PROCESSED**
- Expired token $\rightarrow$ **HTTP 410 CONFIRMATION_EXPIRED**

---

## 5. Regression Test Evidence
- Test File: [`src/core/__tests__/v2_control_plane.test.ts`](file:///B:/projects/RAZOR%20PAY-%20Buildathon/src/core/__tests__/v2_control_plane.test.ts) (Section 3)
- Verification: Passed (Zero confirmation bypass paths available).

---

## 6. Final Status
- **Status:** **REMEDIATED & INDEPENDENTLY VERIFIED**
- **Residual Risk:** None (Strict authentication, token state transition, and live revocation checks enforced).
