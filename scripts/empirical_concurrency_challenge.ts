/**
 * EMPIRICAL ADVERSARIAL CONCURRENCY CHALLENGE HARNESS
 * Author: Challenger 1 (Adversarial Concurrency Challenger)
 * 
 * Objective: Empirically stress-test and attempt to break:
 * 1. Nonce deduplication & concurrent nonce race conditions
 * 2. Dual-resource locking (inventory stock & budget under high concurrent load)
 * 3. Webhook deduplication under concurrent barrage
 * 4. Audit ledger hash chain integrity under concurrent writes
 */

import crypto from "node:crypto";
import { initDatabase } from "../src/store/db.js";
import { buildApp } from "../src/server.js";
import { generatePrincipalKeypair, signMandate } from "../src/core/crypto.js";
import { AuditLedger } from "../src/store/audit.js";
import type { CanonicalIntent, MerchantPolicy } from "../src/core/types.js";

interface ChallengeResult {
  suite: string;
  name: string;
  passed: boolean;
  observations: string;
  metrics: Record<string, any>;
}

const results: ChallengeResult[] = [];

async function runHarness() {
  console.log("===============================================================================");
  console.log("🔥 EMPIRICAL CONCURRENCY & RACE-CONDITION ADVERSARIAL STRESS HARNESS");
  console.log("===============================================================================\n");

  const defaultPolicy: MerchantPolicy = {
    policy_version: "pol_challenge_v1",
    effective_at: Math.floor(Date.now() / 1000) - 3600,
    merchant_id: "merch_challenge_01",
    max_transaction_amount: 10000000, // ₹100,000
    allowed_categories: ["electronics", "furniture", "accessories"],
    auto_refund_on_fulfillment_failure: true,
    min_margin_percentage: 10,
  };

  // ---------------------------------------------------------------------------
  // TEST SUITE 1: NONCE DEDUPLICATION & CONCURRENCY RACE
  // ---------------------------------------------------------------------------
  console.log(">>> [SUITE 1] NONCE DEDUPLICATION & CONCURRENT NONCE RACE CONDITIONS");
  {
    // Test 1.1: Sequential duplicate nonce rejection
    const db = initDatabase(":memory:");
    const { app } = await buildApp(db, defaultPolicy);
    await app.ready();

    const keypair = generatePrincipalKeypair();
    const now = Math.floor(Date.now() / 1000);
    const mandateData = {
      mandate_id: `man_nonce_seq_${crypto.randomUUID()}`,
      principal_public_key: keypair.publicKeyHex,
      budget_limit: 10000000,
      currency: "INR" as const,
      merchant_whitelist: [defaultPolicy.merchant_id],
      category_whitelist: ["electronics", "furniture", "accessories"],
      expiry: now + 3600,
    };
    const signature = signMandate(mandateData, keypair.privateKeyObject);
    const mandate = { ...mandateData, signature };

    const sharedNonce = `nonce_fixed_test_${crypto.randomBytes(8).toString("hex")}`;
    const intent1: CanonicalIntent = {
      intent_id: crypto.randomUUID(),
      client_nonce: sharedNonce,
      timestamp: now,
      mandate,
      proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
    };

    const res1 = await app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent1 });
    const code1 = res1.statusCode;

    const intent2: CanonicalIntent = {
      intent_id: crypto.randomUUID(), // Different intent ID
      client_nonce: sharedNonce,       // Same nonce!
      timestamp: now,
      mandate,
      proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
    };

    const res2 = await app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent2 });
    const code2 = res2.statusCode;
    const body2 = res2.json();

    const seqNoncePassed = code1 === 201 && code2 === 409 && body2.error === "DUPLICATE_NONCE_REPLAY";
    results.push({
      suite: "NONCE",
      name: "Sequential Nonce Replay Rejection",
      passed: seqNoncePassed,
      observations: `First: ${code1}, Second: ${code2} (${body2.error})`,
      metrics: { code1, code2, error: body2.error },
    });
    console.log(`  - 1.1 Sequential Nonce Replay: ${seqNoncePassed ? "PASS" : "FAIL"}`);

    // Test 1.2: Concurrent Nonce Barrage (20 parallel requests with IDENTICAL nonce, different intent IDs)
    const concurrentNonce = `nonce_race_${crypto.randomBytes(8).toString("hex")}`;
    const CONCURRENT_NONCE_WORKERS = 20;

    const noncePromises = Array.from({ length: CONCURRENT_NONCE_WORKERS }, (_, i) => {
      const intent: CanonicalIntent = {
        intent_id: `intent_nonce_race_${i}_${crypto.randomUUID()}`,
        client_nonce: concurrentNonce, // ALL share the same nonce
        timestamp: now,
        mandate,
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
      };
      return app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent });
    });

    const nonceResponses = await Promise.all(noncePromises);
    const nonceSuccesses = nonceResponses.filter((r) => r.statusCode === 201);
    const nonce409s = nonceResponses.filter((r) => r.statusCode === 409);
    const nonce500s = nonceResponses.filter((r) => r.statusCode === 500);
    const otherCodes = nonceResponses.filter((r) => r.statusCode !== 201 && r.statusCode !== 409 && r.statusCode !== 500);

    const concurrentNoncePassed = nonceSuccesses.length === 1 && nonce409s.length === CONCURRENT_NONCE_WORKERS - 1 && nonce500s.length === 0;
    results.push({
      suite: "NONCE",
      name: "Concurrent Nonce Race Collision Safety",
      passed: concurrentNoncePassed,
      observations: `Successes: ${nonceSuccesses.length}, 409 Blocked: ${nonce409s.length}, 500 Crashes: ${nonce500s.length}, Others: ${otherCodes.length}`,
      metrics: {
        total: CONCURRENT_NONCE_WORKERS,
        successes: nonceSuccesses.length,
        blocked_409: nonce409s.length,
        server_error_500: nonce500s.length,
      },
    });
    console.log(`  - 1.2 Concurrent Nonce Collision (${CONCURRENT_NONCE_WORKERS} workers): ${concurrentNoncePassed ? "PASS" : "FAIL"}`);
    if (nonce500s.length > 0) {
      console.log(`    ⚠️ Found 500 errors during nonce race: ${nonce500s[0].body}`);
    }

    await app.close();
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 2: DUAL-RESOURCE LOCKING UNDER HIGH CONCURRENCY
  // ---------------------------------------------------------------------------
  console.log("\n>>> [SUITE 2] DUAL-RESOURCE LOCKING UNDER HIGH CONCURRENCY");
  {
    // Test 2.1: 50 concurrent checkouts competing for 1 unit of stock
    const db = initDatabase(":memory:");
    const { app } = await buildApp(db, defaultPolicy);
    await app.ready();

    // Set available stock of SKU-KEYBOARD-RGB to exactly 1
    db.prepare("UPDATE catalog_items SET available_stock = 1 WHERE sku = 'SKU-KEYBOARD-RGB'").run();

    const keypair = generatePrincipalKeypair();
    const now = Math.floor(Date.now() / 1000);
    const mandateData = {
      mandate_id: `man_stock_race_${crypto.randomUUID()}`,
      principal_public_key: keypair.publicKeyHex,
      budget_limit: 100000000, // ₹1,000,000 (abundant budget)
      currency: "INR" as const,
      merchant_whitelist: [defaultPolicy.merchant_id],
      category_whitelist: ["electronics", "furniture", "accessories"],
      expiry: now + 3600,
    };
    const signature = signMandate(mandateData, keypair.privateKeyObject);
    const mandate = { ...mandateData, signature };

    const WORKERS = 50;
    const promises = Array.from({ length: WORKERS }, (_, i) => {
      const intent: CanonicalIntent = {
        intent_id: `intent_stock_race_${i}_${crypto.randomUUID()}`,
        client_nonce: `nonce_stock_race_${i}_${crypto.randomBytes(8).toString("hex")}`,
        timestamp: now,
        mandate,
        proposed_items: [{ sku: "SKU-KEYBOARD-RGB", quantity: 1 }],
      };
      return app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent });
    });

    const responses = await Promise.all(promises);
    const successes = responses.filter((r) => r.statusCode === 201);
    const blocked409 = responses.filter((r) => r.statusCode === 409);
    const crashes500 = responses.filter((r) => r.statusCode === 500);

    const stockRow = db.prepare("SELECT available_stock FROM catalog_items WHERE sku = 'SKU-KEYBOARD-RGB'").get() as any;
    const finalStock = Number(stockRow.available_stock);
    const totalReservations = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE status = 'HELD'").get() as any;

    const stockRacePassed = successes.length === 1 && blocked409.length === WORKERS - 1 && crashes500.length === 0 && finalStock === 0 && Number(totalReservations.count) === 1;

    results.push({
      suite: "DUAL_LOCK",
      name: "50 Concurrent Checkouts vs 1 Stock Unit",
      passed: stockRacePassed,
      observations: `Successes: ${successes.length}, Blocked: ${blocked409.length}, Crashes: ${crashes500.length}, Final Stock: ${finalStock}, Reservations: ${totalReservations.count}`,
      metrics: {
        concurrency: WORKERS,
        successes: successes.length,
        blocked: blocked409.length,
        crashes: crashes500.length,
        finalStock,
        totalReservations: totalReservations.count,
      },
    });
    console.log(`  - 2.1 50 Workers vs 1 Inventory Unit: ${stockRacePassed ? "PASS" : "FAIL"} (Successes: ${successes.length}, Stock: ${finalStock})`);

    // Test 2.2: Concurrent Budget Depletion Warfare (50 concurrent workers, budget only covers 3)
    // Mouse unit price is ₹2,124 (212,400 paise).
    // Set budget to exactly 500,000 paise (can afford 2 mice, but not 3)
    const budgetKeypair = generatePrincipalKeypair();
    const budgetMandateData = {
      mandate_id: `man_budget_race_${crypto.randomUUID()}`,
      principal_public_key: budgetKeypair.publicKeyHex,
      budget_limit: 500000, // ₹5,000.00
      currency: "INR" as const,
      merchant_whitelist: [defaultPolicy.merchant_id],
      category_whitelist: ["electronics", "furniture", "accessories"],
      expiry: now + 3600,
    };
    const budgetSig = signMandate(budgetMandateData, budgetKeypair.privateKeyObject);
    const budgetMandate = { ...budgetMandateData, signature: budgetSig };

    // SKU-MOUSE-PRO has abundant stock
    db.prepare("UPDATE catalog_items SET available_stock = 100 WHERE sku = 'SKU-MOUSE-PRO'").run();

    const BUDGET_WORKERS = 50;
    const budgetPromises = Array.from({ length: BUDGET_WORKERS }, (_, i) => {
      const intent: CanonicalIntent = {
        intent_id: `intent_budget_race_${i}_${crypto.randomUUID()}`,
        client_nonce: `nonce_budget_race_${i}_${crypto.randomBytes(8).toString("hex")}`,
        timestamp: now,
        mandate: budgetMandate,
        proposed_items: [{ sku: "SKU-MOUSE-PRO", quantity: 1 }],
      };
      return app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent });
    });

    const budgetResponses = await Promise.all(budgetPromises);
    const budgetSuccesses = budgetResponses.filter((r) => r.statusCode === 201);
    const budgetBlocked = budgetResponses.filter((r) => r.statusCode === 409);
    const budgetCrashes = budgetResponses.filter((r) => r.statusCode === 500);

    const mandateRow = db.prepare("SELECT remaining_budget FROM buyer_mandates WHERE mandate_id = ?").get(budgetMandate.mandate_id) as any;
    const remainingBudget = Number(mandateRow.remaining_budget);

    // 500,000 - (2 * 212,400) = 500,000 - 424,800 = 75,200 paise remaining
    const budgetRacePassed = budgetSuccesses.length === 2 && budgetBlocked.length === BUDGET_WORKERS - 2 && budgetCrashes.length === 0 && remainingBudget === 75200;

    results.push({
      suite: "DUAL_LOCK",
      name: "50 Concurrent Checkouts vs Tight Budget (2 affordable)",
      passed: budgetRacePassed,
      observations: `Successes: ${budgetSuccesses.length}, Blocked: ${budgetBlocked.length}, Crashes: ${budgetCrashes.length}, Remaining Budget: ${remainingBudget}`,
      metrics: {
        concurrency: BUDGET_WORKERS,
        successes: budgetSuccesses.length,
        blocked: budgetBlocked.length,
        crashes: budgetCrashes.length,
        remainingBudget,
      },
    });
    console.log(`  - 2.2 50 Workers vs Budget Limit: ${budgetRacePassed ? "PASS" : "FAIL"} (Successes: ${budgetSuccesses.length}, Remaining: ₹${remainingBudget / 100})`);

    // Test 2.3: Multi-SKU Partial Lock Rollback Invariant
    // Item A has 5 units, Item B has 0 units. Checkout requests both A and B.
    // Ensure Item A's stock is NEVER decremented on transaction abort.
    db.prepare("UPDATE catalog_items SET available_stock = 5 WHERE sku = 'SKU-MOUSE-PRO'").run();
    db.prepare("UPDATE catalog_items SET available_stock = 0 WHERE sku = 'SKU-KEYBOARD-RGB'").run();

    const partialLockPromises = Array.from({ length: 10 }, (_, i) => {
      const intent: CanonicalIntent = {
        intent_id: `intent_partial_${i}_${crypto.randomUUID()}`,
        client_nonce: `nonce_partial_${i}_${crypto.randomBytes(8).toString("hex")}`,
        timestamp: now,
        mandate,
        proposed_items: [
          { sku: "SKU-MOUSE-PRO", quantity: 1 },
          { sku: "SKU-KEYBOARD-RGB", quantity: 1 },
        ],
      };
      return app.inject({ method: "POST", url: "/v1/agent/checkout", payload: intent });
    });

    const partialResponses = await Promise.all(partialLockPromises);
    const partialBlocked = partialResponses.filter((r) => r.statusCode === 409);
    const mouseStockRow = db.prepare("SELECT available_stock FROM catalog_items WHERE sku = 'SKU-MOUSE-PRO'").get() as any;
    const partialRollbackPassed = partialBlocked.length === 10 && Number(mouseStockRow.available_stock) === 5;

    results.push({
      suite: "DUAL_LOCK",
      name: "Multi-SKU Partial Lock Atomic Rollback",
      passed: partialRollbackPassed,
      observations: `Blocked: ${partialBlocked.length}/10, Available Stock of SKU-MOUSE-PRO preserved at: ${mouseStockRow.available_stock}`,
      metrics: { blocked: partialBlocked.length, mouseStock: Number(mouseStockRow.available_stock) },
    });
    console.log(`  - 2.3 Multi-SKU Partial Lock Rollback: ${partialRollbackPassed ? "PASS" : "FAIL"}`);

    await app.close();
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 3: WEBHOOK DEDUPLICATION & CONCURRENCY BARRAGE
  // ---------------------------------------------------------------------------
  console.log("\n>>> [SUITE 3] WEBHOOK DEDUPLICATION & CONCURRENT WEBHOOK BARRAGE");
  {
    const db = initDatabase(":memory:");
    const { app, services } = await buildApp(db, defaultPolicy);
    await app.ready();

    const keypair = generatePrincipalKeypair();
    const now = Math.floor(Date.now() / 1000);
    const mandateId = `man_wh_${crypto.randomUUID()}`;
    const intentId = `intent_wh_${crypto.randomUUID()}`;
    const reservationId = `res_wh_${crypto.randomUUID()}`;
    const orderId = `order_wh_${crypto.randomUUID()}`;
    const paymentId = `pay_wh_${crypto.randomUUID()}`;

    // Setup initial DB state: mandate, reservation, order_session
    db.prepare(`
      INSERT INTO buyer_mandates (mandate_id, principal_public_key, budget_limit, remaining_budget, currency, expiry, signature, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(mandateId, keypair.publicKeyHex, 500000, 400000, "INR", now + 3600, "sig", Date.now());

    db.prepare(`
      INSERT INTO reservations (reservation_id, intent_id, mandate_id, reserved_budget, status, created_at, expires_at)
      VALUES (?, ?, ?, ?, 'HELD', ?, ?)
    `).run(reservationId, intentId, mandateId, 100000, Date.now(), Date.now() + 600000);

    db.prepare(`
      INSERT INTO order_sessions (intent_id, receipt, razorpay_order_id, razorpay_payment_id, amount, currency, status, reservation_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, 100000, 'INR', 'ORDER_CREATED', ?, ?, ?)
    `).run(intentId, intentId, orderId, null, reservationId, Date.now(), Date.now());

    const webhookPayload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: orderId,
            amount: 100000,
            status: "captured",
          },
        },
      },
    };

    const webhookSecret = (services.webhookProcessor as any).webhookSecret || "rzp_webhook_secret_test";
    const rawBodyStr = JSON.stringify(webhookPayload);
    const signature = crypto.createHmac("sha256", webhookSecret).update(rawBodyStr).digest("hex");

    // Test 3.1: 20 Parallel Concurrent Webhooks with identical payload and event ID
    const PARALLEL_WEBHOOKS = 20;
    const webhookPromises = Array.from({ length: PARALLEL_WEBHOOKS }, (_, i) => {
      return app.inject({
        method: "POST",
        url: "/webhooks/razorpay",
        headers: {
          "content-type": "application/json",
          "x-razorpay-signature": signature,
          "x-razorpay-event-id": `evt_parallel_${i}`, // Note: even if event ID varies, payload_hash catches duplicates!
        },
        payload: rawBodyStr,
      });
    });

    const webhookResponses = await Promise.all(webhookPromises);
    const processed = webhookResponses.filter((r) => r.json().status === "PROCESSED");
    const duplicateIgnored = webhookResponses.filter((r) => r.json().status === "DUPLICATE_IGNORED");
    const errors = webhookResponses.filter((r) => r.statusCode !== 200 || (r.json().status !== "PROCESSED" && r.json().status !== "DUPLICATE_IGNORED"));

    const sessionRow = db.prepare("SELECT status FROM order_sessions WHERE intent_id = ?").get(intentId) as any;
    const processedEventsCount = db.prepare("SELECT COUNT(*) as count FROM processed_webhook_events WHERE order_id = ?").get(orderId) as any;

    const webhookBarragePassed = processed.length === 1 && duplicateIgnored.length === PARALLEL_WEBHOOKS - 1 && errors.length === 0 && sessionRow.status === "PAYMENT_CAPTURED" && Number(processedEventsCount.count) === 1;

    results.push({
      suite: "WEBHOOK",
      name: "20 Parallel Webhook Requests Barrage",
      passed: webhookBarragePassed,
      observations: `Processed: ${processed.length}, Duplicate Ignored: ${duplicateIgnored.length}, Errors: ${errors.length}, Session Status: ${sessionRow.status}, Recorded Events: ${processedEventsCount.count}`,
      metrics: {
        total: PARALLEL_WEBHOOKS,
        processed: processed.length,
        duplicateIgnored: duplicateIgnored.length,
        errors: errors.length,
        sessionStatus: sessionRow.status,
        recordedEvents: processedEventsCount.count,
      },
    });
    console.log(`  - 3.1 20 Parallel Webhook Barrage: ${webhookBarragePassed ? "PASS" : "FAIL"} (Processed: ${processed.length}, Duplicates Ignored: ${duplicateIgnored.length})`);

    // Test 3.2: Replay of payment.captured against already REFUNDED session
    // Mark session as REFUNDED
    db.prepare("UPDATE order_sessions SET status = 'REFUNDED' WHERE intent_id = ?").run(intentId);

    const postRefundRes = await app.inject({
      method: "POST",
      url: "/webhooks/razorpay",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": signature,
        "x-razorpay-event-id": "evt_replay_post_refund",
      },
      payload: rawBodyStr,
    });

    const postRefundBody = postRefundRes.json();
    const sessionAfterPostRefund = db.prepare("SELECT status FROM order_sessions WHERE intent_id = ?").get(intentId) as any;

    // Must NOT mutate session back to PAYMENT_CAPTURED
    const postRefundPassed = sessionAfterPostRefund.status === "REFUNDED";
    results.push({
      suite: "WEBHOOK",
      name: "Late Webhook Against Terminal REFUNDED Session",
      passed: postRefundPassed,
      observations: `Response: ${postRefundBody.status} (${postRefundBody.message}), Session status preserved as: ${sessionAfterPostRefund.status}`,
      metrics: { status: postRefundBody.status, finalSessionStatus: sessionAfterPostRefund.status },
    });
    console.log(`  - 3.2 Late Webhook Against REFUNDED Session: ${postRefundPassed ? "PASS" : "FAIL"}`);

    await app.close();
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 4: AUDIT LEDGER CONCURRENT WRITE HASH CHAIN INTEGRITY
  // ---------------------------------------------------------------------------
  console.log("\n>>> [SUITE 4] AUDIT LEDGER CONCURRENT WRITE HASH CHAIN INTEGRITY");
  {
    const db = initDatabase(":memory:");
    const auditLedger = new AuditLedger(db);

    const CONCURRENT_AUDIT_WRITES = 100;
    console.log(`  - Launching ${CONCURRENT_AUDIT_WRITES} concurrent audit log transitions...`);

    // Simulate 100 concurrent log transitions across different intents
    const auditPromises = Array.from({ length: CONCURRENT_AUDIT_WRITES }, (_, i) => {
      return new Promise<void>((resolve, reject) => {
        // Use setImmediate to randomize microtask interleaved execution
        setImmediate(() => {
          try {
            auditLedger.logTransition(
              `intent_audit_${i}`,
              `EVENT_TYPE_${i % 5}`,
              "STATE_A" as any,
              "STATE_B" as any,
              { workerIndex: i, randomData: crypto.randomBytes(16).toString("hex") }
            );
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    });

    await Promise.all(auditPromises);

    const rowCount = db.prepare("SELECT COUNT(*) as count FROM audit_ledger").get() as any;
    const totalBlocks = Number(rowCount.count);

    // Verify cryptographic integrity of the linear hash chain
    const verification = auditLedger.verifyLedgerIntegrity();

    const auditPassed = verification.isValid && verification.checkedBlocks === totalBlocks && totalBlocks === CONCURRENT_AUDIT_WRITES;

    results.push({
      suite: "AUDIT_LEDGER",
      name: `Concurrent Audit Writes Integrity (${CONCURRENT_AUDIT_WRITES} blocks)`,
      passed: auditPassed,
      observations: `Valid: ${verification.isValid}, Verified Blocks: ${verification.checkedBlocks}/${totalBlocks}, Error: ${verification.error || "None"}`,
      metrics: {
        totalBlocks,
        verifiedBlocks: verification.checkedBlocks,
        isValid: verification.isValid,
        error: verification.error,
      },
    });
    console.log(`  - 4.1 Concurrent Audit Hash Chain: ${auditPassed ? "PASS" : "FAIL"} (Verified: ${verification.checkedBlocks}/${totalBlocks}, Valid: ${verification.isValid})`);

    // Test 4.2: Deliberate Tamper Detection on the resulting chain
    // Mutate one block's payload in the middle of the chain
    const targetBlock = db.prepare("SELECT audit_id, details_json FROM audit_ledger WHERE rowid = 50").get() as any;
    db.prepare("UPDATE audit_ledger SET details_json = ? WHERE audit_id = ?").run(
      JSON.stringify({ tampered: true }),
      targetBlock.audit_id
    );

    const tamperVerification = auditLedger.verifyLedgerIntegrity();
    const tamperDetected = !tamperVerification.isValid && tamperVerification.checkedBlocks === 49;

    results.push({
      suite: "AUDIT_LEDGER",
      name: "Tamper Detection on Block 50",
      passed: tamperDetected,
      observations: `Tamper Detected: ${tamperDetected}, Error: ${tamperVerification.error}`,
      metrics: { tamperDetected, checkedBlocks: tamperVerification.checkedBlocks, error: tamperVerification.error },
    });
    console.log(`  - 4.2 Tamper Detection Oracle: ${tamperDetected ? "PASS" : "FAIL"} (Detected at block: ${tamperVerification.checkedBlocks})`);
  }

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log("📊 EMPIRICAL HARNESS SUMMARY");
  console.log("===============================================================================");

  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? "✅ PASS" : "❌ FAIL";
    if (!r.passed) allPassed = false;
    console.log(`${icon} [${r.suite}] ${r.name}`);
    console.log(`   Observations: ${r.observations}`);
  }

  console.log("===============================================================================");
  console.log(`FINAL RESULT: ${allPassed ? "ALL 8 TESTS PASSED EMPIRICALLY" : "FAILURES DETECTED"}`);
  console.log("===============================================================================\n");

  if (!allPassed) {
    process.exit(1);
  }
}

runHarness().catch((err) => {
  console.error("Harness crashed with fatal error:", err);
  process.exit(1);
});
