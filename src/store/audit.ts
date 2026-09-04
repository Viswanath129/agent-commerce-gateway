import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { AuditRecord, TransactionState } from "../core/types.js";

export class AuditLedger {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  /**
   * Appends an audit entry with cryptographic hash chaining using rowid ordering.
   */
  public logTransition(
    intentId: string,
    eventType: string,
    prevState: TransactionState | null,
    newState: TransactionState,
    details: Record<string, unknown>
  ): AuditRecord {
    let inTx = false;
    try {
      this.db.exec("BEGIN IMMEDIATE;");
      inTx = true;
    } catch (e: any) {
      if (!e.message?.includes("cannot start a transaction within a transaction")) {
        throw e;
      }
    }

    try {
      // 1. Fetch latest record hash for chaining using rowid (exact FIFO insertion order)
      const lastRow = this.db
        .prepare("SELECT record_hash FROM audit_ledger ORDER BY rowid DESC LIMIT 1")
        .get() as { record_hash?: string } | undefined;

      const prevHash = lastRow?.record_hash || "GENESIS_BLOCK_0000000000000000";
      const timestamp = Date.now();
      const auditId = `audit_${crypto.randomUUID()}`;
      const detailsJson = JSON.stringify(details);

      // 2. Compute SHA-256 Hash over block contents + previous hash
      const blockPayload = `${auditId}|${intentId}|${timestamp}|${eventType}|${prevState || "NULL"}|${newState}|${detailsJson}|${prevHash}`;
      const recordHash = crypto.createHash("sha256").update(blockPayload).digest("hex");

      // 3. Insert atomically into DB
      this.db
        .prepare(`
          INSERT INTO audit_ledger (
            audit_id, intent_id, timestamp, event_type, previous_state, new_state, details_json, record_hash, previous_record_hash
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(auditId, intentId, timestamp, eventType, prevState, newState, detailsJson, recordHash, prevHash);

      if (inTx) {
        this.db.exec("COMMIT;");
      }

      return {
        audit_id: auditId,
        intent_id: intentId,
        timestamp,
        event_type: eventType,
        previous_state: prevState,
        new_state: newState,
        details,
        record_hash: recordHash,
      };
    } catch (err) {
      if (inTx) {
        this.db.exec("ROLLBACK;");
      }
      throw err;
    }
  }

  /**
   * Retrieves full audit trajectory for an intent.
   */
  public getTrajectory(intentId: string) {
    return this.db
      .prepare("SELECT * FROM audit_ledger WHERE intent_id = ? ORDER BY rowid ASC")
      .all(intentId);
  }

  /**
   * Verifies the cryptographic integrity of the entire audit chain.
   */
  public verifyLedgerIntegrity(): { isValid: boolean; checkedBlocks: number; error?: string } {
    const rows = this.db
      .prepare("SELECT * FROM audit_ledger ORDER BY rowid ASC")
      .all() as unknown as Array<{
        audit_id: string;
        intent_id: string;
        timestamp: number;
        event_type: string;
        previous_state: string | null;
        new_state: string;
        details_json: string;
        record_hash: string;
        previous_record_hash: string;
      }>;

    let expectedPrevHash = "GENESIS_BLOCK_0000000000000000";

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.previous_record_hash !== expectedPrevHash) {
        return {
          isValid: false,
          checkedBlocks: i,
          error: `Broken chain link at block ${row.audit_id}: expected ${expectedPrevHash}, found ${row.previous_record_hash}`,
        };
      }

      const payload = `${row.audit_id}|${row.intent_id}|${row.timestamp}|${row.event_type}|${row.previous_state || "NULL"}|${row.new_state}|${row.details_json}|${row.previous_record_hash}`;
      const computedHash = crypto.createHash("sha256").update(payload).digest("hex");

      if (computedHash !== row.record_hash) {
        return {
          isValid: false,
          checkedBlocks: i,
          error: `Tampered hash at block ${row.audit_id}`,
        };
      }

      expectedPrevHash = row.record_hash;
    }

    return { isValid: true, checkedBlocks: rows.length };
  }
}
