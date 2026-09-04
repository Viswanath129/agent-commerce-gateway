import type { DatabaseSync } from "node:sqlite";

export interface VelocityLimits {
  perMinutePaise?: number;
  perMinuteCount?: number;
  perHourPaise?: number;
  perHourCount?: number;
  perDayPaise?: number;
  perDayCount?: number;
}

export interface VelocityCheckResult {
  allowed: boolean;
  reason?: string;
  code?: string;
  currentMinuteCount?: number;
  currentMinutePaise?: number;
}

export class VelocityEngine {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  public recordAction(entityType: "AGENT" | "MERCHANT" | "SESSION", entityId: string, amountPaise: number): void {
    const now = Math.floor(Date.now() / 1000);
    this.db
      .prepare(`
        INSERT INTO velocity_ledger (entity_type, entity_id, amount, timestamp)
        VALUES (?, ?, ?, ?)
      `)
      .run(entityType, entityId, amountPaise, now);
  }

  public checkVelocity(
    entityType: "AGENT" | "MERCHANT" | "SESSION",
    entityId: string,
    proposedAmountPaise: number,
    limits: VelocityLimits
  ): VelocityCheckResult {
    const now = Math.floor(Date.now() / 1000);
    const oneMinuteAgo = now - 60;
    const oneHourAgo = now - 3600;
    const oneDayAgo = now - 86400;

    // Per-minute check
    if (limits.perMinuteCount || limits.perMinutePaise) {
      const minRow = this.db
        .prepare(`
          SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as total
          FROM velocity_ledger
          WHERE entity_type = ? AND entity_id = ? AND timestamp >= ?
        `)
        .get(entityType, entityId, oneMinuteAgo) as any;

      const currentCount = Number(minRow.cnt);
      const currentTotal = Number(minRow.total);

      if (limits.perMinuteCount && currentCount >= limits.perMinuteCount) {
        return {
          allowed: false,
          reason: `Velocity limit exceeded: ${currentCount} actions in last 60s (max allowed: ${limits.perMinuteCount})`,
          code: "VELOCITY_PER_MINUTE_COUNT_EXCEEDED",
          currentMinuteCount: currentCount,
          currentMinutePaise: currentTotal,
        };
      }

      if (limits.perMinutePaise && currentTotal + proposedAmountPaise > limits.perMinutePaise) {
        return {
          allowed: false,
          reason: `Velocity amount limit exceeded: ₹${((currentTotal + proposedAmountPaise) / 100).toFixed(2)} in last 60s (max allowed: ₹${(limits.perMinutePaise / 100).toFixed(2)})`,
          code: "VELOCITY_PER_MINUTE_AMOUNT_EXCEEDED",
          currentMinuteCount: currentCount,
          currentMinutePaise: currentTotal,
        };
      }
    }

    // Per-hour check
    if (limits.perHourCount || limits.perHourPaise) {
      const hrRow = this.db
        .prepare(`
          SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as total
          FROM velocity_ledger
          WHERE entity_type = ? AND entity_id = ? AND timestamp >= ?
        `)
        .get(entityType, entityId, oneHourAgo) as any;

      const hrCount = Number(hrRow.cnt);
      const hrTotal = Number(hrRow.total);

      if (limits.perHourCount && hrCount >= limits.perHourCount) {
        return {
          allowed: false,
          reason: `Velocity limit exceeded: ${hrCount} actions in last hour (max allowed: ${limits.perHourCount})`,
          code: "VELOCITY_PER_HOUR_COUNT_EXCEEDED",
        };
      }

      if (limits.perHourPaise && hrTotal + proposedAmountPaise > limits.perHourPaise) {
        return {
          allowed: false,
          reason: `Velocity amount limit exceeded in last hour (max allowed: ₹${(limits.perHourPaise / 100).toFixed(2)})`,
          code: "VELOCITY_PER_HOUR_AMOUNT_EXCEEDED",
        };
      }
    }

    // Per-day check
    if (limits.perDayCount || limits.perDayPaise) {
      const dayRow = this.db
        .prepare(`
          SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as total
          FROM velocity_ledger
          WHERE entity_type = ? AND entity_id = ? AND timestamp >= ?
        `)
        .get(entityType, entityId, oneDayAgo) as any;

      const dayCount = Number(dayRow.cnt);
      const dayTotal = Number(dayRow.total);

      if (limits.perDayCount && dayCount >= limits.perDayCount) {
        return {
          allowed: false,
          reason: `Daily velocity count exceeded: ${dayCount} actions today (max allowed: ${limits.perDayCount})`,
          code: "VELOCITY_PER_DAY_COUNT_EXCEEDED",
        };
      }

      if (limits.perDayPaise && dayTotal + proposedAmountPaise > limits.perDayPaise) {
        return {
          allowed: false,
          reason: `Daily velocity spend limit exceeded (max allowed: ₹${(limits.perDayPaise / 100).toFixed(2)})`,
          code: "VELOCITY_PER_DAY_AMOUNT_EXCEEDED",
        };
      }
    }

    return { allowed: true };
  }
}
