import { apiClient } from "./apiClient.js";
export class AuditApi {
    client;
    constructor(client = apiClient) {
        this.client = client;
    }
    /**
     * Retrieves recent SHA-256 hash-chained audit blocks.
     */
    async getAuditBlocks() {
        return this.client.get("/dashboard/audit");
    }
    /**
     * Runs real server-side cryptographic audit ledger hash chain verification.
     */
    async verifyIntegrity() {
        return this.client.get("/audit/integrity");
    }
}
export const auditApi = new AuditApi();
