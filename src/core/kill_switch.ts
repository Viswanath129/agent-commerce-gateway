import type { DatabaseSync } from "node:sqlite";

export type KillSwitchScope = "GLOBAL" | string; // 'GLOBAL' | 'MERCHANT:<id>' | 'AGENT:<id>'

export interface KillSwitchStatus {
  isPaused: boolean;
  scope?: string;
  reason?: string;
  activatedBy?: string;
  updatedAt?: number;
}

export class KillSwitchEngine {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  public setKillSwitch(
    scope: KillSwitchScope,
    pause: boolean,
    reason: string = "Operational security intervention",
    activatedBy: string = "merchant_admin"
  ): void {
    const now = Math.floor(Date.now() / 1000);
    this.db
      .prepare(`
        INSERT INTO kill_switches (scope, is_paused, reason, activated_by, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(scope) DO UPDATE SET
          is_paused = excluded.is_paused,
          reason = excluded.reason,
          activated_by = excluded.activated_by,
          updated_at = excluded.updated_at
      `)
      .run(scope, pause ? 1 : 0, reason, activatedBy, now);
  }

  public checkKillSwitch(merchantId: string, agentId?: string): KillSwitchStatus {
    // 1. Check Global
    const globalRow = this.db
      .prepare("SELECT * FROM kill_switches WHERE scope = 'GLOBAL' AND is_paused = 1")
      .get() as any;
    if (globalRow) {
      return {
        isPaused: true,
        scope: "GLOBAL",
        reason: globalRow.reason || "Global agent commerce switch engaged",
        activatedBy: globalRow.activated_by,
        updatedAt: Number(globalRow.updated_at),
      };
    }

    // 2. Check Merchant Scope
    const merchantScope = `MERCHANT:${merchantId}`;
    const merchantRow = this.db
      .prepare("SELECT * FROM kill_switches WHERE scope = ? AND is_paused = 1")
      .get(merchantScope) as any;
    if (merchantRow) {
      return {
        isPaused: true,
        scope: merchantScope,
        reason: merchantRow.reason || `Merchant ${merchantId} agent switch engaged`,
        activatedBy: merchantRow.activated_by,
        updatedAt: Number(merchantRow.updated_at),
      };
    }

    // 3. Check Agent Scope
    if (agentId) {
      const agentScope = `AGENT:${agentId}`;
      const agentRow = this.db
        .prepare("SELECT * FROM kill_switches WHERE scope = ? AND is_paused = 1")
        .get(agentScope) as any;
      if (agentRow) {
        return {
          isPaused: true,
          scope: agentScope,
          reason: agentRow.reason || `Agent ${agentId} kill switch engaged`,
          activatedBy: agentRow.activated_by,
          updatedAt: Number(agentRow.updated_at),
        };
      }
    }

    return { isPaused: false };
  }

  public listKillSwitches(): Array<{ scope: string; isPaused: boolean; reason: string; activatedBy: string; updatedAt: number }> {
    const rows = this.db.prepare("SELECT * FROM kill_switches ORDER BY updated_at DESC").all() as any[];
    return rows.map((r) => ({
      scope: r.scope,
      isPaused: Number(r.is_paused) === 1,
      reason: r.reason,
      activatedBy: r.activated_by,
      updatedAt: Number(r.updated_at),
    }));
  }
}
