import { apiClient } from "./apiClient.js";
export class HealthApi {
    client;
    constructor(client = apiClient) {
        this.client = client;
    }
    /**
     * Retrieves operational health probes across all ACG subsystems.
     */
    async getHealth() {
        return this.client.get("/dashboard/health");
    }
}
export const healthApi = new HealthApi();
