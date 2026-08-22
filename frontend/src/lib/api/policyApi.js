import { apiClient } from "./apiClient.js";
export class PolicyApi {
    client;
    constructor(client = apiClient) {
        this.client = client;
    }
    /**
     * Retrieves active merchant policy DSL document.
     */
    async getPolicy() {
        return this.client.get("/dashboard/policies");
    }
    /**
     * Retrieves merchant product catalog grounded in SQLite.
     */
    async getCatalog() {
        return this.client.get("/catalog");
    }
    /**
     * Mutates merchant policy in real-time.
     */
    async updatePolicy(policy) {
        return this.client.put("/v1/merchant/policy", policy);
    }
}
export const policyApi = new PolicyApi();
