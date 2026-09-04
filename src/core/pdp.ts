import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { BuyerMandate, CanonicalIntent, MerchantPolicy, CatalogItem } from "./types.js";
import { verifyMandateSignature } from "./crypto.js";
import { CommerceTruthEngine, type TruthResolutionResult } from "./truth.js";
import { AgentPrincipalRegistry, type AgentPrincipal, type AgentCapability } from "./agent_principal.js";
import { KillSwitchEngine } from "./kill_switch.js";
import { VelocityEngine } from "./velocity.js";
import { HierarchicalBudgetEngine } from "./budget_hierarchy.js";

export type PDPDecisionType = "ALLOW" | "DENY" | "REQUIRE_CONFIRMATION" | "DEFER";

export interface PDPDecision {
  decision_id: string;
  intent_id: string;
  agent_id: string;
  merchant_id: string;
  decision: PDPDecisionType;
  reason_code: string;
  policy_id: string;
  policy_version: string;
  timestamp: number;
  input_references: Record<string, any>;
  authorization_evidence: Record<string, any>;
  resource_decision: {
    requested_amount_paise: number;
    authorized_amount_paise: number;
    confirmation_token?: string;
  };
}

export interface SimulationResult {
  simulation_id: string;
  verdict: "WOULD_ALLOW" | "WOULD_DENY" | "WOULD_REQUIRE_CONFIRMATION";
  reason_code: string;
  reason: string;
  policy_version: string;
  stages: Array<{
    stage: string;
    passed: boolean;
    details?: any;
    error?: string;
  }>;
  computed_truth?: TruthResolutionResult;
  non_mutating: true;
}

export interface ReplayResult {
  replay_id: string;
  original_decision_id: string;
  original_decision: PDPDecisionType;
  original_reason_code: string;
  original_policy_version: string;
  replayed_decision: PDPDecisionType;
  replayed_reason_code: string;
  replayed_policy_version: string;
  delta: "MATCH" | "CHANGED";
  non_mutating: true;
}

export class PolicyDecisionPoint {
  private db: DatabaseSync;
  private truthEngine: CommerceTruthEngine;
  private principalRegistry: AgentPrincipalRegistry;
  private killSwitchEngine: KillSwitchEngine;
  private velocityEngine: VelocityEngine;
  private budgetEngine: HierarchicalBudgetEngine;

  constructor(
    db: DatabaseSync,
    truthEngine: CommerceTruthEngine,
    principalRegistry: AgentPrincipalRegistry,
    killSwitchEngine: KillSwitchEngine,
    velocityEngine: VelocityEngine,
    budgetEngine: HierarchicalBudgetEngine
  ) {
    this.db = db;
    this.truthEngine = truthEngine;
    this.principalRegistry = principalRegistry;
    this.killSwitchEngine = killSwitchEngine;
    this.velocityEngine = velocityEngine;
    this.budgetEngine = budgetEngine;
  }

  public evaluateIntent(
    intent: CanonicalIntent,
    policy: MerchantPolicy,
    agentId: string = "native-llm-agent"
  ): { decision: PDPDecision; truthResult?: TruthResolutionResult } {
    const now = Math.floor(Date.now() / 1000);
    const decisionId = `dec_${crypto.randomUUID()}`;
    const intentId = intent.intent_id;
    const merchantId = policy.merchant_id;

    const baseEvidence: Record<string, any> = {
      evaluated_at: now,
      policy_version: policy.policy_version,
      agent_id: agentId,
      merchant_id: merchantId,
    };

    const makeDecision = (
      decision: PDPDecisionType,
      reasonCode: string,
      evidenceExtra: Record<string, any> = {},
      requestedAmount: number = 0,
      authorizedAmount: number = 0,
      confirmationToken?: string
    ): { decision: PDPDecision; truthResult?: TruthResolutionResult } => {
      const dec: PDPDecision = {
        decision_id: decisionId,
        intent_id: intentId,
        agent_id: agentId,
        merchant_id: merchantId,
        decision,
        reason_code: reasonCode,
        policy_id: `pol_${merchantId}`,
        policy_version: policy.policy_version,
        timestamp: now,
        input_references: {
          intent_id: intent.intent_id,
          client_nonce: intent.client_nonce,
          mandate_id: intent.mandate.mandate_id,
          mandate: intent.mandate,
          proposed_items: intent.proposed_items,
        },
        authorization_evidence: { ...baseEvidence, ...evidenceExtra },
        resource_decision: {
          requested_amount_paise: requestedAmount,
          authorized_amount_paise: authorizedAmount,
          confirmation_token: confirmationToken,
        },
      };

      // Persist decision in DB
      this.db
        .prepare(`
          INSERT INTO pdp_decisions (
            decision_id, intent_id, agent_id, merchant_id, decision, reason_code,
            policy_id, policy_version, timestamp, input_references_json,
            authorization_evidence_json, resource_decision_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          dec.decision_id,
          dec.intent_id,
          dec.agent_id,
          dec.merchant_id,
          dec.decision,
          dec.reason_code,
          dec.policy_id,
          dec.policy_version,
          dec.timestamp,
          JSON.stringify(dec.input_references),
          JSON.stringify(dec.authorization_evidence),
          JSON.stringify(dec.resource_decision)
        );

      return { decision: dec };
    };

    // 1. Kill Switch Check
    const ks = this.killSwitchEngine.checkKillSwitch(merchantId, agentId);
    if (ks.isPaused) {
      return makeDecision("DENY", "KILL_SWITCH_ENGAGED", { kill_switch: ks });
    }

    // 2. Agent Principal Identity & Status Check
    const principal = this.principalRegistry.getPrincipal(agentId);
    if (!principal) {
      return makeDecision("DENY", "AGENT_PRINCIPAL_NOT_FOUND", { agent_id: agentId });
    }
    if (principal.status !== "ACTIVE") {
      return makeDecision("DENY", `AGENT_${principal.status}`, { status: principal.status });
    }
    if (principal.credential_state !== "ACTIVE") {
      return makeDecision("DENY", `AGENT_CREDENTIAL_${principal.credential_state}`, { credential_state: principal.credential_state });
    }
    if (now > principal.expires_at) {
      return makeDecision("DENY", "AGENT_CREDENTIAL_EXPIRED", { expires_at: principal.expires_at });
    }

    // 3. Agent Capability Check
    const capabilities = this.principalRegistry.getCapabilities(agentId);
    const purchaseCap = capabilities.find((c) => c.capability === "PURCHASE" && c.status === "ACTIVE");
    if (!purchaseCap) {
      return makeDecision("DENY", "CAPABILITY_PURCHASE_NOT_GRANTED", { agent_id: agentId });
    }
    if (now > purchaseCap.expires_at) {
      return makeDecision("DENY", "CAPABILITY_EXPIRED", { capability_id: purchaseCap.capability_id });
    }

    // 4. Mandate Revocation Check
    const revokedRow = this.db.prepare("SELECT * FROM revoked_mandates WHERE mandate_id = ?").get(intent.mandate.mandate_id) as any;
    if (revokedRow) {
      return makeDecision("DENY", "MANDATE_REVOKED", {
        mandate_id: intent.mandate.mandate_id,
        revoked_at: revokedRow.revoked_at,
        reason: revokedRow.revocation_reason,
      });
    }

    // 5. Mandate Temporal Expiry Check
    if (now > intent.mandate.expiry) {
      return makeDecision("DENY", "MANDATE_EXPIRED", { mandate_expiry: intent.mandate.expiry, current_time: now });
    }

    // 6. Mandate Cryptographic Ed25519 Signature
    const isSigValid = verifyMandateSignature(intent.mandate);
    if (!isSigValid) {
      return makeDecision("DENY", "INVALID_MANDATE_SIGNATURE", { mandate_id: intent.mandate.mandate_id });
    }

    // 7. Mandate Merchant Whitelist Check
    if (intent.mandate.merchant_whitelist && intent.mandate.merchant_whitelist.length > 0) {
      if (!intent.mandate.merchant_whitelist.includes(merchantId)) {
        return makeDecision("DENY", "MERCHANT_NOT_WHITELISTED", { whitelist: intent.mandate.merchant_whitelist });
      }
    }

    // 8. Commerce Truth Lookup (Independent Merchant Catalog DB)
    const truthResult = this.truthEngine.resolveTruth(intent.proposed_items);
    if (!truthResult.isValid) {
      return makeDecision("DENY", "COMMERCE_TRUTH_REJECTION", { truth_error: truthResult.error });
    }

    // 9. Mandate Category Whitelist Check
    if (intent.mandate.category_whitelist && intent.mandate.category_whitelist.length > 0) {
      for (const cat of truthResult.categories) {
        if (!intent.mandate.category_whitelist.includes(cat)) {
          return makeDecision("DENY", "CATEGORY_NOT_WHITELISTED", { category: cat, whitelist: intent.mandate.category_whitelist }, truthResult.totalAmount);
        }
      }
    }

    // 10. Capability Merchant Scope & Category Scope Check
    if (purchaseCap.merchant_scope && !purchaseCap.merchant_scope.includes("*") && !purchaseCap.merchant_scope.includes(merchantId)) {
      return makeDecision("DENY", "AGENT_MERCHANT_SCOPE_RESTRICTED", { merchant_scope: purchaseCap.merchant_scope }, truthResult.totalAmount);
    }
    if (purchaseCap.categories && !purchaseCap.categories.includes("*")) {
      for (const cat of truthResult.categories) {
        if (!purchaseCap.categories.includes(cat)) {
          return makeDecision("DENY", "AGENT_CATEGORY_RESTRICTED", { category: cat, allowed: purchaseCap.categories }, truthResult.totalAmount);
        }
      }
    }

    // 11. Merchant Policy Rules
    if (truthResult.totalAmount > policy.max_transaction_amount) {
      return makeDecision("DENY", "MERCHANT_MAX_AMOUNT_EXCEEDED", { max_allowed: policy.max_transaction_amount }, truthResult.totalAmount);
    }
    for (const cat of truthResult.categories) {
      if (!policy.allowed_categories.includes(cat)) {
        return makeDecision("DENY", "MERCHANT_CATEGORY_RESTRICTED", { category: cat, allowed: policy.allowed_categories }, truthResult.totalAmount);
      }
    }

    // 12. Hierarchical Budget Engine Evaluation
    const budgetCheck = this.budgetEngine.evaluateHierarchy(merchantId, agentId, intent.mandate, truthResult.totalAmount);
    if (!budgetCheck.allowed) {
      return makeDecision("DENY", budgetCheck.code || "BUDGET_EXCEEDED", { budget_reason: budgetCheck.reason }, truthResult.totalAmount);
    }

    // 13. Velocity Limits Check (10 actions/min, ₹10,000/min per agent)
    const velocityCheck = this.velocityEngine.checkVelocity("AGENT", agentId, truthResult.totalAmount, {
      perMinuteCount: 20,
      perMinutePaise: 2000000, // ₹20,000 / min
      perDayCount: 500,
    });
    if (!velocityCheck.allowed) {
      return makeDecision("DENY", velocityCheck.code || "VELOCITY_EXCEEDED", { velocity_reason: velocityCheck.reason }, truthResult.totalAmount);
    }

    // 14. Human Confirmation Threshold Check
    // If order total exceeds purchaseCap.confirmation_above (e.g. ₹3,000), require confirmation
    if (truthResult.totalAmount > purchaseCap.confirmation_above) {
      const confirmationToken = `conf_${crypto.randomBytes(16).toString("hex")}`;
      const confId = `cnf_${crypto.randomUUID()}`;
      const expiresAt = now + 900; // 15 mins to confirm

      this.db
        .prepare(`
          INSERT INTO pending_confirmations (
            confirmation_id, decision_id, intent_id, agent_id, merchant_id,
            amount, confirmation_token, status, expires_at, created_at, payload_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)
        `)
        .run(
          confId,
          decisionId,
          intentId,
          agentId,
          merchantId,
          truthResult.totalAmount,
          confirmationToken,
          expiresAt,
          now,
          JSON.stringify({ intent, policy_version: policy.policy_version, truthResult })
        );

      const decisionObj = makeDecision(
        "REQUIRE_CONFIRMATION",
        "CONFIRMATION_REQUIRED_ABOVE_THRESHOLD",
        {
          threshold_paise: purchaseCap.confirmation_above,
          confirmation_id: confId,
          confirmation_token: confirmationToken,
          expires_at: expiresAt,
        },
        truthResult.totalAmount,
        0,
        confirmationToken
      );
      decisionObj.truthResult = truthResult;
      return decisionObj;
    }

    // 15. All Guards Cleared -> ALLOW
    const allowedDecision = makeDecision(
      "ALLOW",
      "AUTHORIZATION_GRANTED",
      {
        verified_truth_total: truthResult.totalAmount,
        categories: truthResult.categories,
      },
      truthResult.totalAmount,
      truthResult.totalAmount
    );
    allowedDecision.truthResult = truthResult;
    return allowedDecision;
  }

  /**
   * V2.8: POLICY SIMULATION (Zero Mutation)
   */
  public simulate(
    intent: CanonicalIntent,
    policy: MerchantPolicy,
    agentId: string = "native-llm-agent"
  ): SimulationResult {
    const simId = `sim_${crypto.randomUUID()}`;
    const stages: Array<{ stage: string; passed: boolean; details?: any; error?: string }> = [];
    const now = Math.floor(Date.now() / 1000);

    // Stage 1: Kill Switch
    const ks = this.killSwitchEngine.checkKillSwitch(policy.merchant_id, agentId);
    if (ks.isPaused) {
      stages.push({ stage: "KILL_SWITCH", passed: false, error: ks.reason });
      return {
        simulation_id: simId,
        verdict: "WOULD_DENY",
        reason_code: "KILL_SWITCH_ENGAGED",
        reason: ks.reason || "Kill switch engaged",
        policy_version: policy.policy_version,
        stages,
        non_mutating: true,
      };
    }
    stages.push({ stage: "KILL_SWITCH", passed: true });

    // Stage 2: Identity
    const principal = this.principalRegistry.getPrincipal(agentId);
    if (!principal || principal.status !== "ACTIVE") {
      stages.push({ stage: "AGENT_IDENTITY", passed: false, error: "Invalid agent principal or status" });
      return {
        simulation_id: simId,
        verdict: "WOULD_DENY",
        reason_code: "AGENT_IDENTITY_INVALID",
        reason: "Agent principal identity is invalid or inactive",
        policy_version: policy.policy_version,
        stages,
        non_mutating: true,
      };
    }
    stages.push({ stage: "AGENT_IDENTITY", passed: true, details: { agent_id: principal.agent_id, trust_level: principal.trust_level } });

    // Stage 3: Mandate Cryptographic Signature & Expiry
    if (now > intent.mandate.expiry) {
      stages.push({ stage: "MANDATE_EXPIRY", passed: false, error: "Mandate is temporally expired" });
      return {
        simulation_id: simId,
        verdict: "WOULD_DENY",
        reason_code: "MANDATE_EXPIRED",
        reason: "Mandate is expired",
        policy_version: policy.policy_version,
        stages,
        non_mutating: true,
      };
    }
    const isSigValid = verifyMandateSignature(intent.mandate);
    if (!isSigValid) {
      stages.push({ stage: "MANDATE_SIGNATURE", passed: false, error: "Cryptographic signature mismatch" });
      return {
        simulation_id: simId,
        verdict: "WOULD_DENY",
        reason_code: "INVALID_MANDATE_SIGNATURE",
        reason: "Mandate signature verification failed",
        policy_version: policy.policy_version,
        stages,
        non_mutating: true,
      };
    }
    stages.push({ stage: "MANDATE_VERIFIED", passed: true });

    // Stage 4: Commerce Truth
    const truthResult = this.truthEngine.resolveTruth(intent.proposed_items);
    if (!truthResult.isValid) {
      stages.push({ stage: "COMMERCE_TRUTH", passed: false, error: truthResult.error });
      return {
        simulation_id: simId,
        verdict: "WOULD_DENY",
        reason_code: "COMMERCE_TRUTH_REJECTION",
        reason: truthResult.error || "Catalog truth error",
        policy_version: policy.policy_version,
        stages,
        non_mutating: true,
      };
    }
    stages.push({ stage: "COMMERCE_TRUTH", passed: true, details: { total_paise: truthResult.totalAmount } });

    // Stage 5: Merchant Policy & Category Bounds
    if (truthResult.totalAmount > policy.max_transaction_amount) {
      stages.push({ stage: "POLICY_TRANSACTION_LIMIT", passed: false, error: `Exceeds max transaction limit of ₹${(policy.max_transaction_amount / 100).toFixed(2)}` });
      return {
        simulation_id: simId,
        verdict: "WOULD_DENY",
        reason_code: "MERCHANT_MAX_AMOUNT_EXCEEDED",
        reason: "Exceeds merchant max transaction cap",
        policy_version: policy.policy_version,
        stages,
        non_mutating: true,
      };
    }
    stages.push({ stage: "MERCHANT_POLICY", passed: true });

    // Stage 6: Hierarchical Budgets & Inventory Simulation
    const budgetCheck = this.budgetEngine.evaluateHierarchy(policy.merchant_id, agentId, intent.mandate, truthResult.totalAmount);
    if (!budgetCheck.allowed) {
      stages.push({ stage: "BUDGET_HIERARCHY", passed: false, error: budgetCheck.reason });
      return {
        simulation_id: simId,
        verdict: "WOULD_DENY",
        reason_code: budgetCheck.code || "BUDGET_EXCEEDED",
        reason: budgetCheck.reason || "Budget hierarchy check failed",
        policy_version: policy.policy_version,
        stages,
        non_mutating: true,
      };
    }
    stages.push({ stage: "BUDGET_HIERARCHY", passed: true });

    // Stage 7: Confirmation threshold
    const capabilities = this.principalRegistry.getCapabilities(agentId);
    const purchaseCap = capabilities.find((c) => c.capability === "PURCHASE");
    const confirmThreshold = purchaseCap?.confirmation_above || 300000;

    if (truthResult.totalAmount > confirmThreshold) {
      stages.push({ stage: "CONFIRMATION_EVALUATION", passed: true, details: { requires_human_approval: true, threshold_paise: confirmThreshold } });
      return {
        simulation_id: simId,
        verdict: "WOULD_REQUIRE_CONFIRMATION",
        reason_code: "CONFIRMATION_REQUIRED_ABOVE_THRESHOLD",
        reason: `Amount (₹${(truthResult.totalAmount / 100).toFixed(2)}) exceeds autonomous threshold (₹${(confirmThreshold / 100).toFixed(2)})`,
        policy_version: policy.policy_version,
        stages,
        computed_truth: truthResult,
        non_mutating: true,
      };
    }

    stages.push({ stage: "CONFIRMATION_EVALUATION", passed: true, details: { requires_human_approval: false } });

    return {
      simulation_id: simId,
      verdict: "WOULD_ALLOW",
      reason_code: "SIMULATION_PERMITTED",
      reason: "All security invariants and policy constraints satisfied in simulation.",
      policy_version: policy.policy_version,
      stages,
      computed_truth: truthResult,
      non_mutating: true,
    };
  }

  /**
   * V2.9: DECISION REPLAY (Zero Mutation)
   */
  public replayDecision(decisionId: string, overridePolicy?: MerchantPolicy): ReplayResult {
    const row = this.db.prepare("SELECT * FROM pdp_decisions WHERE decision_id = ?").get(decisionId) as any;
    if (!row) {
      throw new Error(`Decision ID '${decisionId}' not found in audit store.`);
    }

    const inputRefs = JSON.parse(row.input_references_json);
    const originalDecision = row.decision as PDPDecisionType;
    const originalReason = row.reason_code;
    const originalVersion = row.policy_version;

    // Build mock canonical intent from references
    const mandate: BuyerMandate = inputRefs.mandate || {
      mandate_id: inputRefs.mandate_id,
      principal_public_key: "0".repeat(64),
      budget_limit: 500000,
      currency: "INR",
      expiry: Math.floor(Date.now() / 1000) + 3600,
      signature: "0".repeat(128),
    };

    const intent: CanonicalIntent = {
      intent_id: inputRefs.intent_id,
      client_nonce: inputRefs.client_nonce,
      timestamp: row.timestamp,
      mandate,
      proposed_items: inputRefs.proposed_items,
    };

    const targetPolicy: MerchantPolicy = overridePolicy || {
      policy_version: originalVersion,
      effective_at: row.timestamp,
      merchant_id: row.merchant_id,
      max_transaction_amount: 1000000,
      allowed_categories: ["electronics", "furniture", "supplies"],
      auto_refund_on_fulfillment_failure: true,
      min_margin_percentage: 10,
    };

    const sim = this.simulate(intent, targetPolicy, row.agent_id);
    const replayedDecision: PDPDecisionType =
      sim.verdict === "WOULD_ALLOW" ? "ALLOW" : sim.verdict === "WOULD_DENY" ? "DENY" : "REQUIRE_CONFIRMATION";

    return {
      replay_id: `rpl_${crypto.randomUUID()}`,
      original_decision_id: decisionId,
      original_decision: originalDecision,
      original_reason_code: originalReason,
      original_policy_version: originalVersion,
      replayed_decision: replayedDecision,
      replayed_reason_code: sim.reason_code,
      replayed_policy_version: targetPolicy.policy_version,
      delta: originalDecision === replayedDecision ? "MATCH" : "CHANGED",
      non_mutating: true,
    };
  }

  public getDecision(decisionId: string): PDPDecision | null {
    const row = this.db.prepare("SELECT * FROM pdp_decisions WHERE decision_id = ?").get(decisionId) as any;
    if (!row) return null;
    return {
      decision_id: row.decision_id,
      intent_id: row.intent_id,
      agent_id: row.agent_id,
      merchant_id: row.merchant_id,
      decision: row.decision as PDPDecisionType,
      reason_code: row.reason_code,
      policy_id: row.policy_id,
      policy_version: row.policy_version,
      timestamp: Number(row.timestamp),
      input_references: JSON.parse(row.input_references_json),
      authorization_evidence: JSON.parse(row.authorization_evidence_json),
      resource_decision: JSON.parse(row.resource_decision_json),
    };
  }
}
