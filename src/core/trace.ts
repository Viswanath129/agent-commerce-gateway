import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export interface TracePhase {
  name: string;
  status: "PASS" | "FAIL" | "WARN" | "SKIPPED";
  durationMs: number;
  details?: Record<string, any>;
}

export interface DecisionTrace {
  traceId: string;
  intentId: string;
  agentId: string;
  merchantId: string;
  totalLatencyMs: number;
  phases: TracePhase[];
  createdAt: number;
}

export class DecisionTraceRecorder {
  private db: DatabaseSync;
  private currentPhases: TracePhase[] = [];
  private startTime: number;
  private traceId: string;
  private intentId: string;
  private agentId: string;
  private merchantId: string;

  constructor(db: DatabaseSync, intentId: string, agentId: string, merchantId: string) {
    this.db = db;
    this.intentId = intentId;
    this.agentId = agentId;
    this.merchantId = merchantId;
    this.traceId = `trc_${crypto.randomUUID()}`;
    this.startTime = performance.now();
  }

  public recordPhase(name: string, status: "PASS" | "FAIL" | "WARN" | "SKIPPED", durationMs: number, details?: Record<string, any>): void {
    // Sanitize any secrets from details
    const sanitizedDetails = details ? this.sanitize(details) : undefined;
    this.currentPhases.push({
      name,
      status,
      durationMs: Number(durationMs.toFixed(3)),
      details: sanitizedDetails,
    });
  }

  private sanitize(obj: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (/key|secret|token|password|auth/i.test(k)) {
        sanitized[k] = "[REDACTED]";
      } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        sanitized[k] = this.sanitize(v);
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }

  public finalize(): DecisionTrace {
    const totalLatencyMs = Number((performance.now() - this.startTime).toFixed(2));
    const now = Math.floor(Date.now() / 1000);

    const trace: DecisionTrace = {
      traceId: this.traceId,
      intentId: this.intentId,
      agentId: this.agentId,
      merchantId: this.merchantId,
      totalLatencyMs,
      phases: this.currentPhases,
      createdAt: now,
    };

    try {
      this.db
        .prepare(`
          INSERT INTO decision_traces (
            trace_id, intent_id, agent_id, merchant_id, total_latency_ms, phases_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          trace.traceId,
          trace.intentId,
          trace.agentId,
          trace.merchantId,
          trace.totalLatencyMs,
          JSON.stringify(trace.phases),
          trace.createdAt
        );
    } catch (_) {}

    return trace;
  }

  public static getTrace(db: DatabaseSync, traceId: string): DecisionTrace | null {
    const row = db.prepare("SELECT * FROM decision_traces WHERE trace_id = ?").get(traceId) as any;
    if (!row) return null;
    return {
      traceId: row.trace_id,
      intentId: row.intent_id,
      agentId: row.agent_id,
      merchantId: row.merchant_id,
      totalLatencyMs: Number(row.total_latency_ms),
      phases: JSON.parse(row.phases_json),
      createdAt: Number(row.created_at),
    };
  }

  public static getTraceByIntent(db: DatabaseSync, intentId: string): DecisionTrace | null {
    const row = db.prepare("SELECT * FROM decision_traces WHERE intent_id = ? ORDER BY created_at DESC LIMIT 1").get(intentId) as any;
    if (!row) return null;
    return {
      traceId: row.trace_id,
      intentId: row.intent_id,
      agentId: row.agent_id,
      merchantId: row.merchant_id,
      totalLatencyMs: Number(row.total_latency_ms),
      phases: JSON.parse(row.phases_json),
      createdAt: Number(row.created_at),
    };
  }
}
