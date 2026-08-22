import { apiClient } from "./apiClient.js";
export class DashboardApi {
    client;
    constructor(client = apiClient) {
        this.client = client;
    }
    /**
     * Fetches real-time aggregated metrics from SQLite.
     */
    async getMetrics() {
        return this.client.get("/dashboard/metrics");
    }
}
export const dashboardApi = new DashboardApi();
