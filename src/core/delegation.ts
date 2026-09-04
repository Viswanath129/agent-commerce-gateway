import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { AgentPrincipalRegistry } from "./agent_principal.js";

export interface DelegationGrant {
  delegationId: string;
  parentAgentId: string;
  childAgentId: string;
  merchantId: string;
  maxAmountPaise: number;
  currency: string;
  allowedActions: string[];
  expiresAt: number;
  createdAt: number;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
}

export interface DelegationValidationResult {
  valid: boolean;
  reason?: string;
  code?: string;
  delegation?: DelegationGrant;
}

export class MultiAgentDelegationEngine {
  private db: DatabaseSync;
  private principalRegistry: AgentPrincipalRegistry;

  constructor(db: DatabaseSync, principalRegistry: AgentPrincipalRegistry) {
    this.db = db;
    this.principalRegistry = principalRegistry;
  }

  public createDelegation(
    parentAgentId: string,
    childAgentId: string,
    merchantId: string,
    maxAmountPaise: number,
    allowedActions: string[],
    durationSeconds: number = 3600
  ): DelegationGrant {
    const parent = this.principalRegistry.getPrincipal(parentAgentId);
    if (!parent || parent.status !== "ACTIVE") {
      throw new Error(`Parent agent '${parentAgentId}' is not active or does not exist`);
    }

    const parentCaps = this.principalRegistry.getCapabilities(parentAgentId);
    const parentPurchaseCap = parentCaps.find((c) => c.capability === "PURCHASE" && c.status === "ACTIVE");
    if (!parentPurchaseCap) {
      throw new Error(`Parent agent '${parentAgentId}' lacks active PURCHASE capability`);
    }

    // Invariant: Child authority cannot exceed parent authority ceiling
    if (maxAmountPaise > parentPurchaseCap.max_amount) {
      throw new Error(
        `Delegation amount ₹${(maxAmountPaise / 100).toFixed(2)} exceeds parent ceiling ₹${(parentPurchaseCap.max_amount / 100).toFixed(2)}`
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + durationSeconds;
    const delegationId = `del_${crypto.randomUUID()}`;

    const grant: DelegationGrant = {
      delegationId,
      parentAgentId,
      childAgentId,
      merchantId,
      maxAmountPaise,
      currency: "INR",
      allowedActions,
      expiresAt,
      createdAt: now,
      status: "ACTIVE",
    };

    this.db
      .prepare(`
        INSERT INTO delegations (
          delegation_id, parent_agent_id, child_agent_id, merchant_id,
          max_amount_paise, currency, allowed_actions_json, expires_at, created_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
      `)
      .run(
        grant.delegationId,
        grant.parentAgentId,
        grant.childAgentId,
        grant.merchantId,
        grant.maxAmountPaise,
        grant.currency,
        JSON.stringify(grant.allowedActions),
        grant.expiresAt,
        grant.createdAt
      );

    return grant;
  }

  public validateDelegation(
    delegationId: string,
    childAgentId: string,
    merchantId: string,
    requestedAmountPaise: number,
    action: string
  ): DelegationValidationResult {
    const row = this.db.prepare("SELECT * FROM delegations WHERE delegation_id = ?").get(delegationId) as any;
    if (!row) {
      return { valid: false, code: "DELEGATION_NOT_FOUND", reason: `Delegation '${delegationId}' not found` };
    }

    if (row.status !== "ACTIVE") {
      return { valid: false, code: `DELEGATION_${row.status}`, reason: `Delegation is ${row.status}` };
    }

    if (row.child_agent_id !== childAgentId) {
      return { valid: false, code: "DELEGATION_CHILD_MISMATCH", reason: `Child agent mismatch: expected ${row.child_agent_id}, got ${childAgentId}` };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > Number(row.expires_at)) {
      return { valid: false, code: "DELEGATION_EXPIRED", reason: "Delegation grant has expired" };
    }

    // Check Parent Status (If parent is revoked/suspended, child delegation is immediately invalid)
    const parent = this.principalRegistry.getPrincipal(row.parent_agent_id);
    if (!parent || parent.status !== "ACTIVE") {
      return {
        valid: false,
        code: "PARENT_AGENT_INACTIVE",
        reason: `Parent agent '${row.parent_agent_id}' status is ${parent?.status || "NOT_FOUND"}`,
      };
    }

    // Check Merchant Scope
    if (row.merchant_id !== "*" && row.merchant_id !== merchantId) {
      return { valid: false, code: "DELEGATION_MERCHANT_MISMATCH", reason: `Merchant mismatch: granted for '${row.merchant_id}', requested '${merchantId}'` };
    }

    // Check Amount Limit
    if (requestedAmountPaise > Number(row.max_amount_paise)) {
      return {
        valid: false,
        code: "DELEGATION_AMOUNT_EXCEEDED",
        reason: `Requested amount ₹${(requestedAmountPaise / 100).toFixed(2)} exceeds delegated limit ₹${(Number(row.max_amount_paise) / 100).toFixed(2)}`,
      };
    }

    // Check Action
    const allowedActions: string[] = JSON.parse(row.allowed_actions_json);
    if (!allowedActions.includes("*") && !allowedActions.includes(action)) {
      return { valid: false, code: "DELEGATION_ACTION_NOT_PERMITTED", reason: `Action '${action}' not permitted in delegation grant` };
    }

    const delegation: DelegationGrant = {
      delegationId: row.delegation_id,
      parentAgentId: row.parent_agent_id,
      childAgentId: row.child_agent_id,
      merchantId: row.merchant_id,
      maxAmountPaise: Number(row.max_amount_paise),
      currency: row.currency,
      allowedActions,
      expiresAt: Number(row.expires_at),
      createdAt: Number(row.created_at),
      status: row.status,
    };

    return { valid: true, delegation };
  }

  public revokeDelegation(delegationId: string): boolean {
    const res = this.db.prepare("UPDATE delegations SET status = 'REVOKED' WHERE delegation_id = ?").run(delegationId);
    return res.changes > 0;
  }
}
