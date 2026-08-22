import { apiClient } from "./apiClient.js";
export class DemoApi {
    client;
    constructor(client = apiClient) {
        this.client = client;
    }
    /**
     * Executes a real deterministic backend scenario on the gateway.
     */
    async runScenario(scenario) {
        return this.client.post("/dashboard/demo/run-scenario", { scenario });
    }
    /**
     * Direct standard agent checkout ingress endpoint.
     */
    async checkout(payload) {
        return this.client.post("/v1/agent/checkout", payload);
    }
}
export const demoApi = new DemoApi();
