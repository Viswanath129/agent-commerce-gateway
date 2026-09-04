import { apiClient, type ApiClient, ApiError } from "./apiClient.js";
import type { DemoScenarioType, DemoScenarioResult } from "./types.js";

export class DemoApi {
  constructor(private client: ApiClient = apiClient) {}

  /**
   * Executes a real deterministic backend scenario on the gateway.
   */
  public async runScenario(scenario: DemoScenarioType): Promise<DemoScenarioResult> {
    try {
      return await this.client.post<DemoScenarioResult>("/dashboard/demo/run-scenario", { scenario });
    } catch (err: any) {
      if (err instanceof ApiError && err.errorCode && err.errorCode !== 'FORBIDDEN') {
        return {
          scenario,
          status: 'BLOCKED',
          error: err.errorCode,
          message: err.message,
          ...(err.details || {}),
        } as DemoScenarioResult;
      }
      throw err;
    }
  }

  /**
   * Direct standard agent checkout ingress endpoint.
   */
  public async checkout(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.client.post<Record<string, unknown>>("/v1/agent/checkout", payload);
  }
}

export const demoApi = new DemoApi();
