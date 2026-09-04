# Security Policy & Vulnerability Disclosure

## Supported Versions

| Version | Supported | Security Review Status |
| :--- | :---: | :--- |
| `1.0.0-rc` | ✅ | Production Verified Sandbox Release Candidate |
| `< 1.0.0` | ❌ | Deprecated prototype builds |

---

## Reporting a Vulnerability

The Agent Commerce Gateway (ACG) team takes security with paramount importance. If you discover a security vulnerability or suspect an authorization bypass path, please report it responsibly.

### Responsible Disclosure Process
1. **GitHub Private Security Advisory:** Please submit your report via [GitHub Security Advisories](https://github.com/Viswanath129/agent-commerce-gateway/security/advisories) rather than opening a public issue.
2. **What to Include:**
   * Detailed description of the vulnerability.
   * Steps to reproduce, proof-of-concept payload, or test case.
   * Assessment of financial impact (budget leakage, double-spending, signature spoofing).
   * Affected component (Crypto, Truth Engine, Policy Engine, Dual Reservation, Webhook).
3. **Response Timeline:**
   * Initial acknowledgment within 24 hours.
   * Remediation patch and regression test verification within 72 hours.
   * Coordinated disclosure after fix validation.

---

## Security Invariants

* **Fail-Closed:** Any ambiguous or unverified request must be rejected before downstream rails are touched.
* **Deterministic Authority:** AI model outputs are untrusted proposals; database truth and cryptographic buyer signatures strictly govern execution.
