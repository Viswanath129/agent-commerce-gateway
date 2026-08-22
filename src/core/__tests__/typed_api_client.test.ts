import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../../server.js";
import { initDatabase } from "../../store/db.js";
import { ApiClient } from "../../../frontend/src/lib/api/apiClient.js";
import { DashboardApi } from "../../../frontend/src/lib/api/dashboardApi.js";
import { TransactionApi } from "../../../frontend/src/lib/api/transactionApi.js";
import { MandateApi } from "../../../frontend/src/lib/api/mandateApi.js";
import { PolicyApi } from "../../../frontend/src/lib/api/policyApi.js";
import { ReservationApi } from "../../../frontend/src/lib/api/reservationApi.js";
import { AuditApi } from "../../../frontend/src/lib/api/auditApi.js";
import { HealthApi } from "../../../frontend/src/lib/api/healthApi.js";
import { DemoApi } from "../../../frontend/src/lib/api/demoApi.js";

describe("ACG Front-End Typed API Client Library", () => {
  let customClient: ApiClient;
  let dashboard: DashboardApi;
  let transactions: TransactionApi;
  let mandates: MandateApi;
  let policies: PolicyApi;
  let reservations: ReservationApi;
  let audit: AuditApi;
  let health: HealthApi;
  let demo: DemoApi;

  beforeEach(async () => {
    const db = initDatabase(":memory:");
    const { app } = await buildApp(db);
    
    // Inject mock fetch routing through Fastify app.inject
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
    dashboard = new DashboardApi(customClient);
    transactions = new TransactionApi(customClient);
    mandates = new MandateApi(customClient);
    policies = new PolicyApi(customClient);
    reservations = new ReservationApi(customClient);
    audit = new AuditApi(customClient);
    health = new HealthApi(customClient);
    demo = new DemoApi(customClient);
  });

  it("DashboardApi: Fetches typed metrics", async () => {
    const metrics = await dashboard.getMetrics();
    expect(metrics).toHaveProperty("ai_intents_count");
    expect(metrics).toHaveProperty("active_policy_version", "pol_v1.0.0");
  });

  it("TransactionApi: Fetches transactions array", async () => {
    const res = await transactions.getTransactions();
    expect(Array.isArray(res.transactions)).toBe(true);
  });

  it("MandateApi: Fetches mandates and revokes mandate", async () => {
    const res = await mandates.getMandates();
    expect(Array.isArray(res.mandates)).toBe(true);

    const revokeRes = await mandates.revokeMandate({
      mandate_id: "man_typed_test_1",
      reason: "Revoked via typed API client",
    });
    expect(revokeRes.status).toBe("REVOKED");
    expect(revokeRes.mandate_id).toBe("man_typed_test_1");
  });

  it("PolicyApi: Fetches policy and catalog", async () => {
    const pol = await policies.getPolicy();
    expect(pol.policy.policy_version).toBe("pol_v1.0.0");

    const cat = await policies.getCatalog();
    expect(Array.isArray(cat.items)).toBe(true);
    expect(cat.items.length).toBeGreaterThan(0);
  });

  it("ReservationApi: Fetches reservations", async () => {
    const res = await reservations.getReservations();
    expect(Array.isArray(res.reservations)).toBe(true);
  });

  it("AuditApi: Fetches audit blocks and verifies integrity", async () => {
    const blocksRes = await audit.getAuditBlocks();
    expect(Array.isArray(blocksRes.blocks)).toBe(true);

    const integrity = await audit.verifyIntegrity();
    expect(integrity.isValid).toBe(true);
  });

  it("HealthApi: Returns typed system health", async () => {
    const h = await health.getHealth();
    expect(h.status).toBe("HEALTHY");
    expect(h.components.gateway.status).toBe("LIVE");
  });

  it("DemoApi: Executes nominal flow scenario", async () => {
    const res = await demo.runScenario("happy-path");
    expect(res.status).toBe("ORDER_CREATED");
    expect(res.razorpay_order_id).toBeDefined();
  });
});
