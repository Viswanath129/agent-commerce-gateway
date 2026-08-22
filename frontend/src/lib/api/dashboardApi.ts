import { apiClient, type ApiClient } from "./apiClient.js";
import type { DashboardMetrics } from "./types.js";

export class DashboardApi {
  constructor(private client: ApiClient = apiClient) {}

  /**
   * Fetches real-time aggregated metrics from SQLite.
   */
  public async getMetrics(): Promise<DashboardMetrics> {
    return this.client.get<DashboardMetrics>("/dashboard/metrics");
  }
}

export const dashboardApi = new DashboardApi();
