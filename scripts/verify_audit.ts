import path from "node:path";
import fs from "node:fs";
import { initDatabase } from "../src/store/db.js";
import { AuditLedger } from "../src/store/audit.js";

async function main() {
  console.log("===========================================================================");
  console.log("  ACG TAMPER-EVIDENT SHA-256 AUDIT LEDGER VERIFIER");
  console.log("===========================================================================");

  const dbPaths = [
    "./data/acg_gateway.db",
    "./data/demo_simulation.db",
    "./data/live_pentest.db",
  ];

  let verifiedAny = false;

  for (const relativePath of dbPaths) {
    const fullPath = path.resolve(process.cwd(), relativePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`ℹ️  Database ${relativePath} not present (skipping)`);
      continue;
    }

    console.log(`\n🔍 Verifying ledger in: ${relativePath}`);
    const db = initDatabase(fullPath);
    const ledger = new AuditLedger(db);
    const result = ledger.verifyLedgerIntegrity();

    if (result.isValid) {
      console.log(`✅ [PASS] Hash Chain Valid: ${result.checkedBlocks} cryptographically chained blocks verified.`);
    } else {
      console.error(`❌ [FAIL] TAMPER DETECTED: ${result.error}`);
      process.exit(1);
    }
    verifiedAny = true;
  }

  if (!verifiedAny) {
    console.log("\n🧪 Running in-memory cryptographic verification test...");
    const memDb = initDatabase(":memory:");
    const memLedger = new AuditLedger(memDb);
    memLedger.logTransition("init_01", "SYSTEM_BOOT", null, "INIT", { note: "Self-test" });
    memLedger.logTransition("init_01", "SYSTEM_READY", "INIT", "READY", { note: "Self-test 2" });
    const memRes = memLedger.verifyLedgerIntegrity();
    if (memRes.isValid) {
      console.log(`✅ [PASS] In-Memory SHA-256 Hash Chain Self-Test: ${memRes.checkedBlocks} blocks verified.`);
    } else {
      console.error(`❌ [FAIL] Self-test failed: ${memRes.error}`);
      process.exit(1);
    }
  }

  console.log("\n===========================================================================");
  console.log("  ALL AUDIT LEDGER CHAINS ARE CRYPTOGRAPHICALLY SOUND & UNTAMPERED");
  console.log("===========================================================================");
}

main().catch((err) => {
  console.error("Verification execution error:", err);
  process.exit(1);
});
