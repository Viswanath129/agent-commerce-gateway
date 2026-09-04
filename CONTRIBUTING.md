# Contributing to Agent Commerce Gateway (ACG)

Thank you for your interest in contributing to the Agent Commerce Gateway (ACG / MACCP). This project enforces a strict financial-infrastructure engineering discipline.

---

## 1. Development Setup

### Prerequisites
* Node.js v20.x or v22.x LTS
* npm v10+
* Git

### Local Setup Sequence
```bash
# 1. Clone repository
git clone https://github.com/Viswanath129/agent-commerce-gateway.git
cd agent-commerce-gateway

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env

# 4. Run automated test suite
npm test

# 5. Run live adversarial pentest suite
npm run pentest

# 6. Verify audit ledger hash chains
npm run audit:verify
```

---

## 2. Branching & Commit Conventions

### Branch Strategy
* `main`: Protected production-ready release candidate branch.
* `feat/*`: New adapters, verification suites, or merchant policy features.
* `fix/*`: Security remediations, boundary fixes, or schema corrections.

### Commit Messages (Conventional Commits)
Please format all commit messages using conventional prefixes:
* `feat:` A new feature or protocol adapter normalization.
* `fix:` A bug fix or boundary enforcement patch.
* `refactor:` Code refactoring without changing observable behavior.
* `test:` Adding or updating unit, integration, or adversarial tests.
* `docs:` Documentation, evidence artifacts, or architecture guides.
* `chore:` Build scripts, dependency updates, or tool configurations.

---

## 3. Security-Sensitive Changes

Any Pull Request modifying the authorization pipeline, cryptographic verification, SQLite transactions, or webhook handling must include:
1. **Threat Model Consideration:** Explanation of potential failure paths and mitigation.
2. **Negative Regression Tests:** Automated test cases in `src/core/__tests__/` asserting fail-closed behavior.
3. **No Financial Leakage:** Proof that unauthorized actions produce zero inventory locks and zero downstream API calls.
4. **Documentation Updates:** Alignment with `docs/` and `evidence/` artifacts.

---

## 4. Pull Request Checklist

Before submitting a Pull Request, ensure:
- [ ] `npm test` passes 100% (77/77 tests).
- [ ] `npm run pentest` passes all 19 adversarial scenarios.
- [ ] `npm run audit:verify` passes cryptographic hash validation.
- [ ] `npm run build` succeeds with zero TypeScript / Vite compilation errors.
- [ ] No secrets, keys, or credentials committed.
- [ ] No hyperbolic or unsupported claims added to documentation.
