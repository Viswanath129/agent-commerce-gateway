import { apiClient, type ApiClient } from "./apiClient.js";
import type { AuditLedgerResponse, AuditIntegrityResponse } from "./types.js";

export class AuditApi {
  constructor(private client: ApiClient = apiClient) {}

  /**
   * Retrieves recent SHA-256 hash-chained audit blocks.
   */
  public async getAuditBlocks(): Promise<AuditLedgerResponse> {
    return this.client.get<AuditLedgerResponse>("/dashboard/audit");
  }

  /**
   * Runs real server-side cryptographic audit ledger hash chain verification.
   */
  public async verifyIntegrity(): Promise<AuditIntegrityResponse> {
    return this.client.get<AuditIntegrityResponse>("/audit/integrity");
  }
}

export const auditApi = new AuditApi();
