import { z } from "zod";
import type { DatabaseSync } from "node:sqlite";

export type AgentType = "AUTONOMOUS" | "ASSISTED" | "DELEGATED" | "SYSTEM";
export type TrustLevel = "UNTRUSTED" | "PROVISIONAL" | "VERIFIED" | "ENTERPRISE";
export type CredentialState = "ACTIVE" | "ROTATED" | "SUSPENDED" | "REVOKED";
export type PrincipalStatus = "REGISTERED" | "ACTIVE" | "SUSPENDED" | "REVOKED" | "EXPIRED";
export type CapabilityType =
  | "PURCHASE"
  | "PAYMENT"
  | "REFUND"
  | "SUBSCRIPTION"
  | "PAYOUT"
  | "PAYMENT_LINK"
  | "TRANSFER";

export const AgentPrincipalSchema = z.object({
  agent_id: z.string().min(1),
  organization_id: z.string().min(1),
  provider: z.string().min(1),
  model_name: z.string().min(1),
  agent_type: z.enum(["AUTONOMOUS", "ASSISTED", "DELEGATED", "SYSTEM"]),
  trust_level: z.enum(["UNTRUSTED", "PROVISIONAL", "VERIFIED", "ENTERPRISE"]),
  credential_state: z.enum(["ACTIVE", "ROTATED", "SUSPENDED", "REVOKED"]),
  created_at: z.number().int().positive(),
  expires_at: z.number().int().positive(),
  status: z.enum(["REGISTERED", "ACTIVE", "SUSPENDED", "REVOKED", "EXPIRED"]),
  metadata: z.record(z.unknown()).optional(),
});

export type AgentPrincipal = z.infer<typeof AgentPrincipalSchema>;

export const AgentCapabilitySchema = z.object({
  capability_id: z.string().min(1),
  agent_id: z.string().min(1),
  capability: z.enum([
    "PURCHASE",
    "PAYMENT",
    "REFUND",
    "SUBSCRIPTION",
    "PAYOUT",
    "PAYMENT_LINK",
    "TRANSFER",
  ]),
  max_amount: z.number().int().positive(), // in paise
  currency: z.literal("INR"),
  categories: z.array(z.string()).default(["*"]),
  merchant_scope: z.array(z.string()).default(["*"]),
  daily_budget: z.number().int().positive(), // in paise
  daily_spent: z.number().int().nonnegative().default(0),
  confirmation_above: z.number().int().positive().default(300000), // e.g. ₹3,000
  expires_at: z.number().int().positive(),
  status: z.enum(["ACTIVE", "REVOKED"]).default("ACTIVE"),
  created_at: z.number().int().positive(),
});

export type AgentCapability = z.infer<typeof AgentCapabilitySchema>;

export class AgentPrincipalRegistry {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
    this.seedDefaultPrincipals();
  }

  public seedDefaultPrincipals(): void {
    const now = Math.floor(Date.now() / 1000);
    const oneYearLater = now + 365 * 24 * 3600;

    // Default System/Native Agent
    this.upsertPrincipal({
      agent_id: "native-llm-agent",
      organization_id: "org_razorpay_default",
      provider: "anthropic",
      model_name: "claude-3-7-sonnet",
      agent_type: "AUTONOMOUS",
      trust_level: "VERIFIED",
      credential_state: "ACTIVE",
      created_at: now,
      expires_at: oneYearLater,
      status: "ACTIVE",
    });

    this.upsertCapability({
      capability_id: "cap_native_purchase",
      agent_id: "native-llm-agent",
      capability: "PURCHASE",
      max_amount: 10000000, // ₹1,00,000
      currency: "INR",
      categories: ["*"],
      merchant_scope: ["*"],
      daily_budget: 50000000, // ₹5,00,000
      daily_spent: 0,
      confirmation_above: 5000000, // ₹50,000 default threshold (matches merchant max amount)
      expires_at: oneYearLater,
      status: "ACTIVE",
      created_at: now,
    });
  }

  public upsertPrincipal(principal: AgentPrincipal): void {
    this.db
      .prepare(`
        INSERT INTO agent_principals (
          agent_id, organization_id, provider, model_name, agent_type,
          trust_level, credential_state, created_at, expires_at, status, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(agent_id) DO UPDATE SET
          organization_id = excluded.organization_id,
          provider = excluded.provider,
          model_name = excluded.model_name,
          agent_type = excluded.agent_type,
          trust_level = excluded.trust_level,
          credential_state = excluded.credential_state,
          expires_at = excluded.expires_at,
          status = excluded.status,
          metadata_json = excluded.metadata_json
      `)
      .run(
        principal.agent_id,
        principal.organization_id,
        principal.provider,
        principal.model_name,
        principal.agent_type,
        principal.trust_level,
        principal.credential_state,
        principal.created_at,
        principal.expires_at,
        principal.status,
        principal.metadata ? JSON.stringify(principal.metadata) : null
      );
  }

  public getPrincipal(agentId: string): AgentPrincipal | null {
    const row = this.db
      .prepare("SELECT * FROM agent_principals WHERE agent_id = ?")
      .get(agentId) as any;
    if (!row) return null;
    return {
      agent_id: row.agent_id,
      organization_id: row.organization_id,
      provider: row.provider,
      model_name: row.model_name,
      agent_type: row.agent_type as AgentType,
      trust_level: row.trust_level as TrustLevel,
      credential_state: row.credential_state as CredentialState,
      created_at: Number(row.created_at),
      expires_at: Number(row.expires_at),
      status: row.status as PrincipalStatus,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    };
  }

  public listPrincipals(): AgentPrincipal[] {
    const rows = this.db.prepare("SELECT * FROM agent_principals ORDER BY created_at DESC").all() as any[];
    return rows.map((row) => ({
      agent_id: row.agent_id,
      organization_id: row.organization_id,
      provider: row.provider,
      model_name: row.model_name,
      agent_type: row.agent_type as AgentType,
      trust_level: row.trust_level as TrustLevel,
      credential_state: row.credential_state as CredentialState,
      created_at: Number(row.created_at),
      expires_at: Number(row.expires_at),
      status: row.status as PrincipalStatus,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    }));
  }

  public upsertCapability(cap: AgentCapability): void {
    this.db
      .prepare(`
        INSERT INTO agent_capabilities (
          capability_id, agent_id, capability, max_amount, currency,
          categories_json, merchant_scope_json, daily_budget, daily_spent,
          confirmation_above, expires_at, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(capability_id) DO UPDATE SET
          max_amount = excluded.max_amount,
          categories_json = excluded.categories_json,
          merchant_scope_json = excluded.merchant_scope_json,
          daily_budget = excluded.daily_budget,
          confirmation_above = excluded.confirmation_above,
          expires_at = excluded.expires_at,
          status = excluded.status
      `)
      .run(
        cap.capability_id,
        cap.agent_id,
        cap.capability,
        cap.max_amount,
        cap.currency,
        JSON.stringify(cap.categories),
        JSON.stringify(cap.merchant_scope),
        cap.daily_budget,
        cap.daily_spent,
        cap.confirmation_above,
        cap.expires_at,
        cap.status,
        cap.created_at
      );
  }

  public getCapabilities(agentId: string): AgentCapability[] {
    const rows = this.db
      .prepare("SELECT * FROM agent_capabilities WHERE agent_id = ? AND status = 'ACTIVE'")
      .all(agentId) as any[];
    return rows.map((row) => ({
      capability_id: row.capability_id,
      agent_id: row.agent_id,
      capability: row.capability as CapabilityType,
      max_amount: Number(row.max_amount),
      currency: "INR",
      categories: JSON.parse(row.categories_json),
      merchant_scope: JSON.parse(row.merchant_scope_json),
      daily_budget: Number(row.daily_budget),
      daily_spent: Number(row.daily_spent),
      confirmation_above: Number(row.confirmation_above),
      expires_at: Number(row.expires_at),
      status: row.status,
      created_at: Number(row.created_at),
    }));
  }

  public setAgentStatus(agentId: string, status: PrincipalStatus): boolean {
    const res = this.db
      .prepare("UPDATE agent_principals SET status = ? WHERE agent_id = ?")
      .run(status, agentId);
    return res.changes > 0;
  }
}
