import { apiClient, type ApiClient } from "./apiClient.js";
import type { SystemHealthResponse } from "./types.js";

export class HealthApi {
  constructor(private client: ApiClient = apiClient) {}

  /**
   * Retrieves operational health probes across all ACG subsystems.
   */
  public async getHealth(): Promise<SystemHealthResponse> {
    return this.client.get<SystemHealthResponse>("/dashboard/health");
  }
}

export const healthApi = new HealthApi();
