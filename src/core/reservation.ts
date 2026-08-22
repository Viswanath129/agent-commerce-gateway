import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { BuyerMandate, CatalogItem } from "./types.js";

export interface ReservationSuccess {
  success: true;
  reservationId: string;
  intentId: string;
  mandateId: string;
  reservedAmount: number; // paise
  reservedItems: Array<{ sku: string; quantity: number; unitPrice: number; taxAmount: number }>;
}

export interface ReservationFailure {
  success: false;
  reason: string;
  code: "MANDATE_EXHAUSTED" | "INSUFFICIENT_STOCK" | "DATABASE_LOCK_ERROR";
}

export class DualResourceReservationEngine {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  /**
   * Atomically registers or retrieves a mandate balance in the ledger.
   */
  public registerMandateIfAbsent(mandate: BuyerMandate): void {
    const existing = this.db.prepare("SELECT mandate_id FROM buyer_mandates WHERE mandate_id = ?").get(mandate.mandate_id);
    if (!existing) {
      this.db
        .prepare(`
          INSERT INTO buyer_mandates (
            mandate_id, principal_public_key, budget_limit, remaining_budget, currency, expiry, signature, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          mandate.mandate_id,
          mandate.principal_public_key,
          mandate.budget_limit,
          mandate.budget_limit, // initially 100% available
          mandate.currency,
          mandate.expiry,
          mandate.signature,
          Date.now()
        );
    }
  }

  /**
   * ATOMIC DUAL-RESOURCE RESERVATION
   * Atomically locks:
   * 1. Buyer Mandate Remaining Budget (decrements available paise)
   * 2. Merchant SKU Inventory (decrements available units)
   * If either check fails, the entire transaction is rolled back.
   */
  public holdReservation(
    intentId: string,
    mandate: BuyerMandate,
    totalRequiredAmount: number, // paise
    resolvedItems: Array<{
      item: CatalogItem;
      quantity: number;
      subtotal: number;
      tax: number;
      total: number;
    }>,
    ttlSeconds: number = 300 // 5-minute reservation TTL
  ): ReservationSuccess | ReservationFailure {
    this.db.exec("BEGIN IMMEDIATE TRANSACTION;");
    try {
      // 1. Ensure mandate is in ledger
      this.registerMandateIfAbsent(mandate);

      // 2. Lock & Check Mandate Remaining Budget
      const mandateRow = this.db
        .prepare("SELECT remaining_budget FROM buyer_mandates WHERE mandate_id = ?")
        .get(mandate.mandate_id) as { remaining_budget: number | bigint };

      const remainingBudget = Number(mandateRow.remaining_budget);
      if (remainingBudget < totalRequiredAmount) {
        this.db.exec("ROLLBACK;");
        return {
          success: false,
          reason: `Insufficient remaining mandate budget: required ₹${(totalRequiredAmount / 100).toFixed(2)}, available ₹${(remainingBudget / 100).toFixed(2)}`,
          code: "MANDATE_EXHAUSTED",
        };
      }

      // 3. Lock & Check SKU Stock for all items
      for (const resItem of resolvedItems) {
        const stockRow = this.db
          .prepare("SELECT available_stock FROM catalog_items WHERE sku = ?")
          .get(resItem.item.sku) as { available_stock: number | bigint };

        const availableStock = Number(stockRow.available_stock);
        if (availableStock < resItem.quantity) {
          this.db.exec("ROLLBACK;");
          return {
            success: false,
            reason: `Insufficient inventory for SKU '${resItem.item.sku}': requested ${resItem.quantity}, available ${availableStock}`,
            code: "INSUFFICIENT_STOCK",
          };
        }
      }

      // 4. ATOMIC MUTATION A: Decrement Mandate Budget
      this.db
        .prepare("UPDATE buyer_mandates SET remaining_budget = remaining_budget - ? WHERE mandate_id = ?")
        .run(totalRequiredAmount, mandate.mandate_id);

      // 5. ATOMIC MUTATION B: Decrement SKU Inventory Stock
      for (const resItem of resolvedItems) {
        this.db
          .prepare("UPDATE catalog_items SET available_stock = available_stock - ? WHERE sku = ?")
          .run(resItem.quantity, resItem.item.sku);
      }

      // 6. ATOMIC MUTATION C: Create Reservation Record
      const reservationId = `res_${crypto.randomUUID()}`;
      const now = Date.now();
      const expiresAt = now + ttlSeconds * 1000;

      this.db
        .prepare(`
          INSERT INTO reservations (reservation_id, intent_id, mandate_id, reserved_budget, status, created_at, expires_at)
          VALUES (?, ?, ?, ?, 'HELD', ?, ?)
        `)
        .run(reservationId, intentId, mandate.mandate_id, totalRequiredAmount, now, expiresAt);

      // 7. ATOMIC MUTATION D: Store Reservation Item Breakdown
      const insertItemStmt = this.db.prepare(`
        INSERT INTO reservation_items (reservation_id, sku, quantity, unit_price, tax_amount)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const resItem of resolvedItems) {
        insertItemStmt.run(reservationId, resItem.item.sku, resItem.quantity, resItem.item.unit_price, resItem.tax);
      }

      this.db.exec("COMMIT;");

      return {
        success: true,
        reservationId,
        intentId,
        mandateId: mandate.mandate_id,
        reservedAmount: totalRequiredAmount,
        reservedItems: resolvedItems.map((r) => ({
          sku: r.item.sku,
          quantity: r.quantity,
          unitPrice: r.item.unit_price,
          taxAmount: r.tax,
        })),
      };
    } catch (err: any) {
      try {
        this.db.exec("ROLLBACK;");
      } catch (_) {}
      return {
        success: false,
        reason: `Transactional execution failed: ${err.message}`,
        code: "DATABASE_LOCK_ERROR",
      };
    }
  }

  /**
   * ATOMIC DUAL-RESOURCE ROLLBACK
   */
  public releaseReservation(reservationId: string, reason: string): boolean {
    this.db.exec("BEGIN IMMEDIATE TRANSACTION;");
    try {
      const res = this.db
        .prepare("SELECT * FROM reservations WHERE reservation_id = ? AND status = 'HELD'")
        .get(reservationId) as { reservation_id: string; mandate_id: string; reserved_budget: number | bigint } | undefined;

      if (!res) {
        this.db.exec("ROLLBACK;");
        return false;
      }

      const reservedBudget = Number(res.reserved_budget);

      // 1. Restore Mandate Budget
      this.db
        .prepare("UPDATE buyer_mandates SET remaining_budget = remaining_budget + ? WHERE mandate_id = ?")
        .run(reservedBudget, res.mandate_id);

      // 2. Restore Inventory Stock
      const items = this.db
        .prepare("SELECT sku, quantity FROM reservation_items WHERE reservation_id = ?")
        .all(reservationId) as unknown as Array<{ sku: string; quantity: number | bigint }>;

      for (const item of items) {
        this.db
          .prepare("UPDATE catalog_items SET available_stock = available_stock + ? WHERE sku = ?")
          .run(Number(item.quantity), item.sku);
      }

      // 3. Mark Reservation as Released
      this.db
        .prepare("UPDATE reservations SET status = 'RELEASED' WHERE reservation_id = ?")
        .run(reservationId);

      this.db.exec("COMMIT;");
      return true;
    } catch (err) {
      try {
        this.db.exec("ROLLBACK;");
      } catch (_) {}
      return false;
    }
  }

  /**
   * Commits the reservation permanently (payment captured).
   */
  public commitReservation(reservationId: string): boolean {
    const res = this.db
      .prepare("UPDATE reservations SET status = 'COMMITTED' WHERE reservation_id = ? AND status = 'HELD'")
      .run(reservationId);
    return res.changes > 0;
  }
}
