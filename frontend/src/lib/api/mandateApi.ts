import { apiClient, type ApiClient } from "./apiClient.js";
import type { MandatesRegistryResponse, RevokeMandateRequest, RevokeMandateResponse } from "./types.js";

export class MandateApi {
  constructor(private client: ApiClient = apiClient) {}

  /**
   * Retrieves all buyer mandates and revoked mandate records.
   */
  public async getMandates(): Promise<MandatesRegistryResponse> {
    return this.client.get<MandatesRegistryResponse>("/dashboard/mandates");
  }

  /**
   * Revokes a buyer mandate delegation in the control plane database.
   */
  public async revokeMandate(payload: RevokeMandateRequest): Promise<RevokeMandateResponse> {
    return this.client.post<RevokeMandateResponse>("/v1/mandates/revoke", payload);
  }
}

export const mandateApi = new MandateApi();
