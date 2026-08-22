# ACG — Master Reports & Evidence Index

This directory contains the authoritative, evidence-backed reports, security audits, UI interaction verification logs, and empirical performance benchmarks for the **Agent Commerce Gateway (ACG)**.

---

## 📁 Directory Structure & Taxonomy

```text
reports/
├── README.md                             # Master Reports Taxonomy & Navigation Guide
│
├── pentest/                              # 1. APPLICATION SECURITY & ADVERSARIAL AUDIT
│   ├── PENTEST_REPORT.md                 # Comprehensive Executive Penetration Test Report
│   ├── SECURITY_CONTROL_MATRIX.md        # 14-Vector Adversarial Control vs Defense Matrix
│   ├── PENTEST_EVIDENCE.md               # Raw HTTP Request/Response Payloads & Evidence
│   ├── FINDINGS.md                       # Vulnerability & Remediation Ledger (FINDING-ACG-001)
│   ├── RAW_TEST_RESULTS.md               # Automated Vitest & Live Script Execution Logs
│   └── raw_results.json                  # Machine-Readable JSON Pentest Artifact (19 Live Tests)
│
├── ui/                                   # 2. FRONTEND & CONTROL PLANE INTERACTION AUDIT
│   ├── FINAL_UI_QA_REPORT.md             # Final UI QA & Quantitative Scorecard (19/19 Controls)
│   ├── UI_INTERACTION_AUDIT.md           # Itemized Audit of All 19 Controls, APIs, and Outcomes
│   ├── UI_BACKEND_CONSISTENCY.md         # Cryptographic & Relational Proof: UI ≡ API ≡ SQLite
│   ├── DASHBOARD_FUNCTIONALITY_REPORT.md # Functional Verification of All 8 Dashboard Views
│   ├── DASHBOARD_SECURITY_ASSESSMENT.md  # Zero-Trust Frontend Threat Surface Analysis
│   ├── FRONTEND_MIGRATION_REPORT.md      # React Migration, Design Tokens & Component Audit
│   └── LIVE_UI_AUDIT.md                  # Itemized Zero-Mock Mode Verification
│
└── performance/                          # 3. BENCHMARK & LATENCY EVIDENCE
    ├── PERFORMANCE_EVIDENCE.md           # Cold-Run (~286.3ms), Route Latency (~28.8ms), Onboarding (~10-12m)
    └── RAW_TEST_RESULTS.md               # Empirical Execution Timings and Latency Histograms
```

---

## 🛡️ Summary of Verified Security & UI Posture

* **Final Security Verdict:** **PASS WITH OBSERVATIONS** (0 Unauthorized Financial Impact Paths)
* **Automated Unit & Adversarial Tests:** **37 / 37 PASSING**
* **Live HTTP Penetration Tests:** **19 / 19 PASSING**
* **Interactive Control Status:** **19 / 19 PASSING (0 Dead Buttons, 0 Console Errors)**
* **Zero-Mock Policy:** **100% Authoritative SQLite State & Real Deterministic Actions**
