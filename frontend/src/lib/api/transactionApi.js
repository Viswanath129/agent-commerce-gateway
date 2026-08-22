import { apiClient } from "./apiClient.js";
export class TransactionApi {
    client;
    constructor(client = apiClient) {
        this.client = client;
    }
    /**
     * Retrieves list of all persisted order sessions.
     */
    async getTransactions() {
        return this.client.get("/dashboard/transactions");
    }
    /**
     * Retrieves single transaction detail with full cryptographic audit trajectory.
     */
    async getTransactionDetail(intentId) {
        return this.client.get(`/dashboard/transaction/${encodeURIComponent(intentId)}`);
    }
}
export const transactionApi = new TransactionApi();
