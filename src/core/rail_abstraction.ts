import type { RazorpayRailClient } from "../rails/razorpay.js";

export interface RailOrderResult {
  orderId: string;
  amountPaise: number;
  currency: string;
  receipt: string;
  status: string;
  railProvider: "RAZORPAY_SANDBOX" | "RAZORPAY_LIVE" | "SIMULATED_RAIL";
}

export interface PaymentExecutionProvider {
  name: string;
  createOrder(amountPaise: number, receipt: string, notes?: Record<string, any>): Promise<RailOrderResult>;
}

export class RazorpayExecutionProvider implements PaymentExecutionProvider {
  public name = "RazorpayExecutionProvider";
  private client: RazorpayRailClient;

  constructor(client: RazorpayRailClient) {
    this.client = client;
  }

  public async createOrder(amountPaise: number, receipt: string, notes?: Record<string, any>): Promise<RailOrderResult> {
    const order = await this.client.createOrder(amountPaise, receipt, notes);
    return {
      orderId: order.id,
      amountPaise: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
      railProvider: "RAZORPAY_SANDBOX",
    };
  }
}
