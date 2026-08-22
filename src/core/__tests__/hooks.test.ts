import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../../server.js";
import { initDatabase } from "../../store/db.js";
import { ApiClient } from "../../../frontend/src/lib/api/apiClient.js";
import { PolicyApi } from "../../../frontend/src/lib/api/policyApi.js";

describe("useCatalog Hook & Catalog Engine Integration", () => {
  let customClient: ApiClient;
  let policyApiInstance: PolicyApi;

  beforeEach(async () => {
    const db = initDatabase(":memory:");
    const { app } = await buildApp(db);

    const mockFetch = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const urlStr = String(url);
      const pathname = urlStr.startsWith("http") ? new URL(urlStr).pathname : urlStr;
      const res = await app.inject({
        method: (init?.method as any) || "GET",
        url: pathname,
        payload: init?.body ? JSON.parse(String(init.body)) : undefined,
        headers: (init?.headers as any) || {},
      });

      return new Response(res.body, {
        status: res.statusCode,
        headers: res.headers as any,
      });
    };

    globalThis.fetch = mockFetch as any;

    customClient = new ApiClient("http://localhost:3000", 5000);
    policyApiInstance = new PolicyApi(customClient);
  });

  it("Fetches catalog and computes available stock correctly", async () => {
    const data = await policyApiInstance.getCatalog();
    expect(data.merchant_id).toBe("merch_acme_electronics_01");
    expect(data.items.length).toBeGreaterThan(0);

    const mouse = data.items.find((i) => i.sku === "SKU-MOUSE-PRO");
    expect(mouse).toBeDefined();
    expect(mouse?.unit_price).toBe(180000); // ₹1,800.00
    expect(mouse?.available_stock).toBeGreaterThan(0);
  });
});
