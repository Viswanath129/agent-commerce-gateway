import { apiClient } from "./apiClient.js";
export class MandateApi {
    client;
    constructor(client = apiClient) {
        this.client = client;
    }
    /**
     * Retrieves all buyer mandates and revoked mandate records.
     */
    async getMandates() {
        return this.client.get("/dashboard/mandates");
    }
    /**
     * Revokes a buyer mandate delegation in the control plane database.
     */
    async revokeMandate(payload) {
        return this.client.post("/v1/mandates/revoke", payload);
    }
}
export const mandateApi = new MandateApi();
