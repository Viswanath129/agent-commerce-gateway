import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { AgentPrincipalRegistry } from "./agent_principal.js";
import type { KillSwitchEngine } from "./kill_switch.js";

export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type IncidentType =
  | "POLICY_VIOLATION"
  | "VELOCITY_ALERT"
  | "HIGH_RISK_DETECTED"
  | "SIGNATURE_TAMPER"
  | "MANDATE_EXHAUSTED"
  | "KILL_SWITCH_TRIGGER";

export interface IncidentEvent {
  incidentId: string;
  agentId: string;
  merchantId: string;
  intentId?: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  details: Record<string, any>;
  status: "OPEN" | "RESOLVED" | "REVIEWED";
  createdAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
}

export type IncidentActionType =
  | "SUSPEND_AGENT"
  | "REVOKE_AGENT"
  | "REVOKE_MANDATE"
  | "PAUSE_MERCHANT_AGENTS"
  | "CLEAR_AFTER_REVIEW";

export interface IncidentActionResult {
  actionId: string;
  action: IncidentActionType;
  targetId: string;
  success: boolean;
  status: string;
  auditHash?: string;
  timestamp: number;
}

export class IncidentConsoleEngine {
  private db: DatabaseSync;
  private principalRegistry: AgentPrincipalRegistry;
  private killSwitchEngine: KillSwitchEngine;

  constructor(
    db: DatabaseSync,
    principalRegistry: AgentPrincipalRegistry,
    killSwitchEngine: KillSwitchEngine
  ) {
    this.db = db;
    this.principalRegistry = principalRegistry;
    this.killSwitchEngine = killSwitchEngine;
  }

  public recordIncident(
    agentId: string,
    merchantId: string,
    incidentType: IncidentType,
    severity: IncidentSeverity,
    details: Record<string, any>,
    intentId?: string
  ): IncidentEvent {
    const incidentId = `inc_${crypto.randomUUID()}`;
    const now = Math.floor(Date.now() / 1000);

    const incident: IncidentEvent = {
      incidentId,
      agentId,
      merchantId,
      intentId,
      incidentType,
      severity,
      details,
      status: "OPEN",
      createdAt: now,
    };

    this.db
      .prepare(`
        INSERT INTO incident_events (
          incident_id, agent_id, merchant_id, intent_id, incident_type, severity, details_json, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)
      `)
      .run(
        incident.incidentId,
        incident.agentId,
        incident.merchantId,
        incident.intentId || null,
        incident.incidentType,
        incident.severity,
        JSON.stringify(incident.details),
        incident.createdAt
      );

    return incident;
  }

  public listIncidents(status?: string): IncidentEvent[] {
    const query = status
      ? "SELECT * FROM incident_events WHERE status = ? ORDER BY created_at DESC"
      : "SELECT * FROM incident_events ORDER BY created_at DESC";
    const rows = (status ? this.db.prepare(query).all(status) : this.db.prepare(query).all()) as any[];
    return rows.map((r) => ({
      incidentId: r.incident_id,
      agentId: r.agent_id,
      merchantId: r.merchant_id,
      intentId: r.intent_id || undefined,
      incidentType: r.incident_type as IncidentType,
      severity: r.severity as IncidentSeverity,
      details: JSON.parse(r.details_json),
      status: r.status,
      createdAt: Number(r.created_at),
      resolvedAt: r.resolved_at ? Number(r.resolved_at) : undefined,
      resolvedBy: r.resolved_by || undefined,
    }));
  }

  public executeAction(
    action: IncidentActionType,
    targetId: string,
    reason: string = "SecOps incident response",
    actor: string = "secops_lead"
  ): IncidentActionResult {
    const actionId = `act_${crypto.randomUUID()}`;
    const now = Math.floor(Date.now() / 1000);

    switch (action) {
      case "SUSPEND_AGENT":
        this.principalRegistry.setAgentStatus(targetId, "SUSPENDED");
        return {
          actionId,
          action,
          targetId,
          success: true,
          status: "AGENT_SUSPENDED",
          timestamp: now,
        };

      case "REVOKE_AGENT":
        this.principalRegistry.setAgentStatus(targetId, "REVOKED");
        return {
          actionId,
          action,
          targetId,
          success: true,
          status: "AGENT_REVOKED",
          timestamp: now,
        };

      case "REVOKE_MANDATE":
        this.db
          .prepare(`
            INSERT OR REPLACE INTO revoked_mandates (mandate_id, revocation_reason, revoked_at)
            VALUES (?, ?, ?)
          `)
          .run(targetId, reason, now);
        return {
          actionId,
          action,
          targetId,
          success: true,
          status: "MANDATE_REVOKED",
          timestamp: now,
        };

      case "PAUSE_MERCHANT_AGENTS":
        this.killSwitchEngine.setKillSwitch(`MERCHANT:${targetId}`, true, reason, actor);
        return {
          actionId,
          action,
          targetId,
          success: true,
          status: "MERCHANT_AGENTS_PAUSED",
          timestamp: now,
        };

      case "CLEAR_AFTER_REVIEW":
        this.db
          .prepare("UPDATE incident_events SET status = 'RESOLVED', resolved_at = ?, resolved_by = ? WHERE incident_id = ?")
          .run(now, actor, targetId);
        return {
          actionId,
          action,
          targetId,
          success: true,
          status: "INCIDENT_RESOLVED",
          timestamp: now,
        };

      default:
        throw new Error(`Unsupported incident action: ${action}`);
    }
  }
}
