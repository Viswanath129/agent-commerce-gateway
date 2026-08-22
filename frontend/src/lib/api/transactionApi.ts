import { apiClient, type ApiClient } from "./apiClient.js";
import type { OrderSession, TransactionDetailResponse } from "./types.js";

export class TransactionApi {
  constructor(private client: ApiClient = apiClient) {}

  /**
   * Retrieves list of all persisted order sessions.
   */
  public async getTransactions(): Promise<{ transactions: OrderSession[] }> {
    return this.client.get<{ transactions: OrderSession[] }>("/dashboard/transactions");
  }

  /**
   * Retrieves single transaction detail with full cryptographic audit trajectory.
   */
  public async getTransactionDetail(intentId: string): Promise<TransactionDetailResponse> {
    return this.client.get<TransactionDetailResponse>(`/dashboard/transaction/${encodeURIComponent(intentId)}`);
  }
}

export const transactionApi = new TransactionApi();
