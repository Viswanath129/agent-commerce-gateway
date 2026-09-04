import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { AuditLedger } from "../store/audit.js";
import type { DualResourceReservationEngine } from "../core/reservation.js";
import type { RazorpayRailClient } from "./razorpay.js";
import type { MerchantPolicy, TransactionState } from "../core/types.js";

export class RazorpayWebhookProcessor {
  private db: DatabaseSync;
  private audit: AuditLedger;
  private reservationEngine: DualResourceReservationEngine;
  private railClient: RazorpayRailClient;
  private policy: MerchantPolicy;
  private webhookSecret: string;

  constructor(
    db: DatabaseSync,
    audit: AuditLedger,
    reservationEngine: DualResourceReservationEngine,
    railClient: RazorpayRailClient,
    policy: MerchantPolicy,
    webhookSecret?: string
  ) {
    this.db = db;
    this.audit = audit;
    this.reservationEngine = reservationEngine;
    this.railClient = railClient;
    this.policy = policy;
    const envSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (process.env.NODE_ENV === "production" && !envSecret) {
      throw new Error("RAZORPAY_WEBHOOK_SECRET is required. No fallback secrets are permitted in production.");
    }
    this.webhookSecret = webhookSecret || envSecret || "rzp_webhook_secret_test";
    
    // In production, we ensure it's not the test secret unless explicitly set to it (unlikely)
    if (process.env.NODE_ENV === "production" && this.webhookSecret === "rzp_webhook_secret_test" && !envSecret) {
       throw new Error("RAZORPAY_WEBHOOK_SECRET is required. No fallback secrets are permitted in production.");
    }
  }

  /**
   * Verifies Razorpay HMAC SHA256 Webhook Signature.
   * Compares against raw wire bytes first, with fallback to canonical JSON representation.
   */
  public verifySignature(rawBody: string | any, signature: string): boolean {
    if (!signature) return false;
    const bodyStr = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);
    const expectedSignature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(bodyStr)
      .digest("hex");
    const expectedBuf = Buffer.from(expectedSignature, "utf-8");
    const actualBuf = Buffer.from(signature, "utf-8");
    
    if (expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      return true;
    }

    // If rawBody was parsed or reformatted, check normalized JSON serialization
    try {
      const parsed = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
      const normalizedStr = JSON.stringify(parsed);
      const altSignature = crypto
        .createHmac("sha256", this.webhookSecret)
        .update(normalizedStr)
        .digest("hex");
      const altBuf = Buffer.from(altSignature, "utf-8");
      if (altBuf.length === actualBuf.length && crypto.timingSafeEqual(altBuf, actualBuf)) {
        return true;
      }
    } catch {}

    return false;
  }

  /**
   * Processes an incoming Razorpay webhook event with:
   * 1. x-razorpay-event-id deduplication
   * 2. Monotonic state transition
   * 3. Fulfillment dispatch and safe policy-gated refund on failure
   */
  public async processEvent(
    eventId: string,
    eventPayload: {
      event: string;
      payload: {
        payment?: { entity: { id: string; order_id: string; amount: number; status: string } };
        order?: { entity: { id: string; receipt: string; status: string } };
      };
    }
  ): Promise<{ status: "PROCESSED" | "DUPLICATE_IGNORED" | "ORDER_NOT_FOUND" | "ERROR"; message?: string }> {
    // 1. DEDUPLICATION: Check if event_id has already been processed
    const existingEvent = this.db
      .prepare("SELECT event_id FROM processed_webhook_events WHERE event_id = ?")
      .get(eventId);

    if (existingEvent) {
      return { status: "DUPLICATE_IGNORED", message: `Event ID '${eventId}' already processed` };
    }

    const orderId = eventPayload.payload.order?.entity.id || eventPayload.payload.payment?.entity.order_id;
    const paymentId = eventPayload.payload.payment?.entity.id;

    // 2. Find Order Session in Database
    const orderSession = this.db
      .prepare("SELECT * FROM order_sessions WHERE razorpay_order_id = ?")
      .get(orderId || "") as unknown as {
        intent_id: string;
        receipt: string;
        razorpay_order_id: string;
        razorpay_payment_id: string | null;
        amount: number | bigint;
        status: TransactionState;
        reservation_id: string;
      } | undefined;

    if (!orderSession) {
      return { status: "ORDER_NOT_FOUND", message: `No active session for Razorpay Order ID '${orderId || ""}'` };
    }

    const intentId = orderSession.intent_id;

    // 3. Strict State Machine Validation: Prevent illegal transitions from terminal or failed states
    if (eventPayload.event === "payment.captured") {
      if (
        orderSession.status !== "ORDER_CREATED" &&
        orderSession.status !== "PAYMENT_AUTHORIZED" &&
        orderSession.status !== "PAYMENT_ATTEMPTED"
      ) {
        if (orderSession.status === "PAYMENT_CAPTURED") {
          return { status: "DUPLICATE_IGNORED", message: "Order is already in PAYMENT_CAPTURED state" };
        }
        this.audit.logTransition(
          intentId,
          "ILLEGAL_STATE_TRANSITION_BLOCKED",
          orderSession.status,
          orderSession.status,
          {
            eventId,
            orderId,
            paymentId,
            attemptedEvent: eventPayload.event,
            reason: `Illegal state transition from state '${orderSession.status}' to 'PAYMENT_CAPTURED'`,
          }
        );
        return {
          status: "ERROR",
          message: `Illegal state transition: Order session is '${orderSession.status}', cannot transition to 'PAYMENT_CAPTURED'`,
        };
      }

      // Invariant: Verify underlying reservation is still HELD and commit it
      const committed = this.reservationEngine.commitReservation(orderSession.reservation_id);
      if (!committed) {
        this.audit.logTransition(
          intentId,
          "RESERVATION_COMMIT_FAILED",
          orderSession.status,
          orderSession.status,
          {
            reservationId: orderSession.reservation_id,
            reason: `Underlying reservation '${orderSession.reservation_id}' is not in HELD status`,
          }
        );
        return {
          status: "ERROR",
          message: `Cannot capture payment: Underlying reservation '${orderSession.reservation_id}' is not in HELD status`,
        };
      }

      // Valid transition from ORDER_CREATED or PAYMENT_AUTHORIZED with committed reservation
      this.db
        .prepare("UPDATE order_sessions SET status = 'PAYMENT_CAPTURED', razorpay_payment_id = ?, updated_at = ? WHERE intent_id = ?")
        .run(paymentId || null, Date.now(), intentId);

      this.audit.logTransition(intentId, "WEBHOOK_PAYMENT_CAPTURED", orderSession.status, "PAYMENT_CAPTURED", {
        eventId,
        orderId,
        paymentId,
      });

      await this.triggerFulfillment(intentId, orderSession.reservation_id, paymentId || "");
    } else if (eventPayload.event === "payment.authorized") {
      if (
        orderSession.status === "PAYMENT_FAILED" ||
        orderSession.status === "DUAL_RESERVATION_RELEASED" ||
        orderSession.status === "REFUNDED"
      ) {
        this.audit.logTransition(
          intentId,
          "ILLEGAL_STATE_TRANSITION_BLOCKED",
          orderSession.status,
          orderSession.status,
          {
            eventId,
            orderId,
            paymentId,
            attemptedEvent: eventPayload.event,
            reason: `Illegal state transition from terminal state '${orderSession.status}' to 'PAYMENT_AUTHORIZED'`,
          }
        );
        return {
          status: "ERROR",
          message: `Illegal state transition: Order session is '${orderSession.status}', cannot transition to 'PAYMENT_AUTHORIZED'`,
        };
      }

      if (orderSession.status === "PAYMENT_AUTHORIZED" || orderSession.status === "PAYMENT_CAPTURED") {
        return { status: "DUPLICATE_IGNORED", message: `Order is already ${orderSession.status}` };
      }

      this.db
        .prepare("UPDATE order_sessions SET status = 'PAYMENT_AUTHORIZED', razorpay_payment_id = ?, updated_at = ? WHERE intent_id = ?")
        .run(paymentId || null, Date.now(), intentId);

      this.audit.logTransition(intentId, "WEBHOOK_PAYMENT_AUTHORIZED", orderSession.status, "PAYMENT_AUTHORIZED", {
        eventId,
        orderId,
        paymentId,
      });
    } else if (eventPayload.event === "payment.failed") {
      if (orderSession.status === "PAYMENT_CAPTURED" || orderSession.status === "REFUNDED") {
        this.audit.logTransition(
          intentId,
          "ILLEGAL_STATE_TRANSITION_BLOCKED",
          orderSession.status,
          orderSession.status,
          {
            eventId,
            orderId,
            paymentId,
            attemptedEvent: eventPayload.event,
            reason: `Cannot fail payment when order session is already '${orderSession.status}'`,
          }
        );
        return {
          status: "ERROR",
          message: `Illegal state transition: Order session is '${orderSession.status}', cannot transition to 'PAYMENT_FAILED'`,
        };
      }

      if (orderSession.status === "PAYMENT_FAILED") {
        return { status: "DUPLICATE_IGNORED", message: "Order is already PAYMENT_FAILED" };
      }

      this.db
        .prepare("UPDATE order_sessions SET status = 'PAYMENT_FAILED', updated_at = ? WHERE intent_id = ?")
        .run(Date.now(), intentId);

      this.reservationEngine.releaseReservation(orderSession.reservation_id, "Payment failed at bank rail");

      this.audit.logTransition(intentId, "WEBHOOK_PAYMENT_FAILED", orderSession.status, "DUAL_RESERVATION_RELEASED", {
        eventId,
        orderId,
        paymentId,
      });
    }

    // 4. Record Event ID in Deduplication Table
    this.db
      .prepare(`
        INSERT INTO processed_webhook_events (event_id, event_type, order_id, payment_id, processed_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(eventId, eventPayload.event, orderId || null, paymentId || null, Date.now(), JSON.stringify(eventPayload));

    return { status: "PROCESSED" };
  }

  private async triggerFulfillment(intentId: string, reservationId: string, paymentId: string): Promise<void> {
    this.audit.logTransition(intentId, "FULFILLMENT_DISPATCHED", "PAYMENT_CAPTURED", "FULFILLMENT_DISPATCHED", {
      intentId,
      reservationId,
    });
  }

  public async handlePostCaptureFulfillmentFailure(intentId: string, reason: string): Promise<void> {
    const session = this.db
      .prepare("SELECT * FROM order_sessions WHERE intent_id = ?")
      .get(intentId) as any;

    if (!session || !session.razorpay_payment_id) return;

    this.audit.logTransition(intentId, "FULFILLMENT_FAILED", session.status, "FULFILLMENT_FAILED", {
      reason,
      paymentId: session.razorpay_payment_id,
    });

    if (this.policy.auto_refund_on_fulfillment_failure) {
      const refundIdempotencyKey = `rfnd_${intentId}_${Date.now()}`;
      
      this.audit.logTransition(intentId, "REFUND_PENDING", "FULFILLMENT_FAILED", "REFUND_PENDING", {
        refundIdempotencyKey,
        amount: Number(session.amount),
      });

      const refundResult = await this.railClient.createRefund(
        session.razorpay_payment_id,
        Number(session.amount),
        refundIdempotencyKey,
        { reason: "Merchant fulfillment failure stockout" }
      );

      this.db
        .prepare("UPDATE order_sessions SET status = 'REFUNDED', updated_at = ? WHERE intent_id = ?")
        .run(Date.now(), intentId);

      this.audit.logTransition(intentId, "REFUND_PROCESSED", "REFUND_PENDING", "REFUNDED", {
        refundId: refundResult.id,
        status: refundResult.status,
      });
    } else {
      this.db
        .prepare("UPDATE order_sessions SET status = 'MANUAL_REVIEW', updated_at = ? WHERE intent_id = ?")
        .run(Date.now(), intentId);

      this.audit.logTransition(intentId, "ESCALATED_MANUAL_REVIEW", "FULFILLMENT_FAILED", "MANUAL_REVIEW", {
        reason: "Merchant policy requires manual review for post-capture failures",
      });
    }
  }
}
