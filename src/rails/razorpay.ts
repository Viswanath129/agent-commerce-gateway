import crypto from "node:crypto";

export interface RazorpayOrderResponse {
  id: string;
  entity: "order";
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: "created" | "attempted" | "paid";
  attempts: number;
  created_at: number;
}

export interface RazorpayRefundResponse {
  id: string;
  entity: "refund";
  amount: number;
  currency: string;
  payment_id: string;
  receipt?: string;
  status: "processed" | "pending" | "failed";
  created_at: number;
}

export class RazorpayRailClient {
  private keyId: string;
  private keySecret: string;
  private isLiveCredentials: boolean;

  constructor(keyId?: string, keySecret?: string) {
    this.keyId = keyId || process.env.RAZORPAY_KEY_ID || "rzp_test_mock";
    this.keySecret = keySecret || process.env.RAZORPAY_KEY_SECRET || "mock_secret";
    this.isLiveCredentials = this.keyId.startsWith("rzp_test_") && this.keyId !== "rzp_test_placeholder_key";
  }

  /**
   * Creates a Razorpay Order using documented `receipt` idempotency mechanism.
   */
  public async createOrder(
    amountPaise: number,
    receiptIntentId: string,
    notes: Record<string, string> = {}
  ): Promise<RazorpayOrderResponse> {
    if (!this.isLiveCredentials) {
      // Mock deterministic Sandbox response for offline hackathon testing
      return {
        id: `order_${crypto.randomBytes(8).toString("hex")}`,
        entity: "order",
        amount: amountPaise,
        amount_paid: 0,
        amount_due: amountPaise,
        currency: "INR",
        receipt: receiptIntentId,
        status: "created",
        attempts: 0,
        created_at: Math.floor(Date.now() / 1000),
      };
    }

    // Call Real Razorpay API
    const authHeader = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`;
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: receiptIntentId,
        notes,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Razorpay Order creation failed [${response.status}]: ${errorBody}`);
    }

    return (await response.json()) as RazorpayOrderResponse;
  }

  /**
   * Triggers an Idempotent Refund using the official `X-Refund-Idempotency` header.
   */
  public async createRefund(
    paymentId: string,
    amountPaise: number,
    idempotencyKey: string,
    notes: Record<string, string> = {}
  ): Promise<RazorpayRefundResponse> {
    if (!this.isLiveCredentials) {
      return {
        id: `rfnd_${crypto.randomBytes(8).toString("hex")}`,
        entity: "refund",
        amount: amountPaise,
        currency: "INR",
        payment_id: paymentId,
        receipt: idempotencyKey,
        status: "processed",
        created_at: Math.floor(Date.now() / 1000),
      };
    }

    const authHeader = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`;
    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        "X-Refund-Idempotency": idempotencyKey,
      },
      body: JSON.stringify({
        amount: amountPaise,
        notes,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Razorpay Refund failed [${response.status}]: ${errorBody}`);
    }

    return (await response.json()) as RazorpayRefundResponse;
  }

  /**
   * Fetches payment status for active outbox reconciliation.
   */
  public async fetchPayment(paymentId: string): Promise<any> {
    if (!this.isLiveCredentials) {
      return {
        id: paymentId,
        status: "captured",
        amount: 350000,
        currency: "INR",
      };
    }

    const authHeader = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`;
    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: { Authorization: authHeader },
    });

    return await response.json();
  }
}
