import { apiClient, type ApiClient } from "./apiClient.js";
import type { PolicyResponse, MerchantPolicy, CatalogResponse } from "./types.js";

export class PolicyApi {
  constructor(private client: ApiClient = apiClient) {}

  /**
   * Retrieves active merchant policy DSL document.
   */
  public async getPolicy(): Promise<PolicyResponse> {
    return this.client.get<PolicyResponse>("/dashboard/policies");
  }

  /**
   * Retrieves merchant product catalog grounded in SQLite.
   */
  public async getCatalog(): Promise<CatalogResponse> {
    return this.client.get<CatalogResponse>("/catalog");
  }

  /**
   * Mutates merchant policy in real-time.
   */
  public async updatePolicy(policy: MerchantPolicy): Promise<{ status: string; policy: MerchantPolicy }> {
    return this.client.put<{ status: string; policy: MerchantPolicy }>("/v1/merchant/policy", policy);
  }
}

export const policyApi = new PolicyApi();
