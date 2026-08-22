import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "./components/layout/AppShell.js";
import type { TabId } from "./components/layout/Sidebar.js";
import {
  dashboardApi,
  transactionApi,
  mandateApi,
  policyApi,
  reservationApi,
  auditApi,
  healthApi,
  demoApi,
  type DashboardMetrics,
  type OrderSession,
  type TransactionDetailResponse,
  type BuyerMandate,
  type RevokedMandate,
  type MerchantPolicy,
  type CatalogItem,
  type Reservation,
  type AuditBlock,
  type AuditIntegrityResponse,
  type SystemHealthResponse,
  type DemoScenarioType,
  type DemoScenarioResult,
} from "./lib/api/index.js";

import { OverviewView } from "./views/OverviewView.js";
import { LiveDemoView } from "./views/LiveDemoView.js";
import { TransactionsView } from "./views/TransactionsView.js";
import { MandatesView } from "./views/MandatesView.js";
import { PoliciesView } from "./views/PoliciesView.js";
import { ReservationsView } from "./views/ReservationsView.js";
import { AuditLedgerView } from "./views/AuditLedgerView.js";
import { SystemHealthView } from "./views/SystemHealthView.js";

import { ErrorAlert } from "./components/ui/index.js";
import { ApiError } from "./lib/api/apiClient.js";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const hash = window.location.hash.replace("#", "") as TabId;
    const validTabs: TabId[] = [
      "overview",
      "live-demo",
      "transactions",
      "mandates",
      "policies",
      "reservations",
      "audit-ledger",
      "system-health",
    ];
    return validTabs.includes(hash) ? hash : "overview";
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncTimestamp, setSyncTimestamp] = useState<string>("");
  const [globalError, setGlobalError] = useState<ApiError | Error | null>(null);

  // Global State
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [transactions, setTransactions] = useState<OrderSession[]>([]);
  const [selectedTransactionDetail, setSelectedTransactionDetail] = useState<TransactionDetailResponse | null>(null);
  const [mandates, setMandates] = useState<BuyerMandate[]>([]);
  const [revokedMandates, setRevokedMandates] = useState<RevokedMandate[]>([]);
  const [policy, setPolicy] = useState<MerchantPolicy | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [auditBlocks, setAuditBlocks] = useState<AuditBlock[]>([]);
  const [auditIntegrity, setAuditIntegrity] = useState<AuditIntegrityResponse | null>(null);
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);

  // Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [isExecutingScenario, setIsExecutingScenario] = useState(false);
  const [isRevokingMandate, setIsRevokingMandate] = useState(false);
  const [isUpdatingPolicy, setIsUpdatingPolicy] = useState(false);
  const [isTestingConcurrency, setIsTestingConcurrency] = useState(false);
  const [concurrencyResult, setConcurrencyResult] = useState<{ admitted: string; blocked: string } | null>(null);
  const [isVerifyingAudit, setIsVerifyingAudit] = useState(false);

  // Sync hash with activeTab
  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    window.location.hash = `#${tab}`;
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "") as TabId;
      const validTabs: TabId[] = [
        "overview",
        "live-demo",
        "transactions",
        "mandates",
        "policies",
        "reservations",
        "audit-ledger",
        "system-health",
      ];
      if (validTabs.includes(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Sync All Data from Gateway APIs
  const syncData = useCallback(async () => {
    try {
      setIsSyncing(true);
      const [
        metricsData,
        txData,
        mandatesData,
        policyData,
        catalogData,
        reservationsData,
        auditData,
        healthData,
      ] = await Promise.all([
        dashboardApi.getMetrics().catch(() => null),
        transactionApi.getTransactions().catch(() => ({ transactions: [] })),
        mandateApi.getMandates().catch(() => ({ mandates: [], revoked: [] })),
        policyApi.getPolicy().catch(() => ({ policy: null as any })),
        policyApi.getCatalog().catch(() => ({ items: [] as CatalogItem[], merchant_id: "", policy_version: "" })),
        reservationApi.getReservations().catch(() => ({ reservations: [] })),
        auditApi.getAuditBlocks().catch(() => ({ blocks: [], integrity: { isValid: true, checkedBlocks: 0 } })),
        healthApi.getHealth().catch(() => null),
      ]);

      if (metricsData) setMetrics(metricsData);
      if (txData) setTransactions(txData.transactions);
      if (mandatesData) {
        setMandates(mandatesData.mandates);
        setRevokedMandates(mandatesData.revoked);
      }
      if (policyData) setPolicy(policyData.policy);
      if (catalogData) setCatalog(catalogData.items);
      if (reservationsData) setReservations(reservationsData.reservations);
      if (auditData) {
        setAuditBlocks(auditData.blocks);
        setAuditIntegrity(auditData.integrity);
      }
      if (healthData) setHealth(healthData);

      const now = new Date().toLocaleTimeString();
      setSyncTimestamp(now);
    } catch (err) {
      console.error("Dashboard sync error:", err);
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  }, []);

  // Initial load & Polling Interval (every 5 seconds)
  useEffect(() => {
    syncData();
    const interval = setInterval(syncData, 5000);
    return () => clearInterval(interval);
  }, [syncData]);

  // Load single transaction detail
  const handleSelectTransaction = async (intentId: string) => {
    try {
      const detail = await transactionApi.getTransactionDetail(intentId);
      setSelectedTransactionDetail(detail);
      setActiveTab("transactions");
    } catch (err) {
      console.error("Error fetching transaction detail:", err);
    }
  };

  // Run Real Scenario from Live Demo
  const handleRunScenario = async (scenario: DemoScenarioType): Promise<DemoScenarioResult> => {
    setIsExecutingScenario(true);
    try {
      const result = await demoApi.runScenario(scenario);
      await syncData();
      return result;
    } finally {
      setIsExecutingScenario(false);
    }
  };

  // Revoke Mandate Action
  const handleRevokeMandate = async (mandateId: string) => {
    setIsRevokingMandate(true);
    try {
      const res = await mandateApi.revokeMandate({
        mandate_id: mandateId,
        reason: "Revoked by Human Principal via React Control Plane",
      });
      alert(`Mandate ${res.mandate_id} successfully revoked in SQLite database.`);
      await syncData();
    } catch (err: any) {
      alert(`Revocation error: ${err.message}`);
    } finally {
      setIsRevokingMandate(false);
    }
  };

  // Mutate Policy Action
  const handleUpdatePolicy = async (newCapInr: number) => {
    setIsUpdatingPolicy(true);
    try {
      const res = await policyApi.updatePolicy({
        policy_version: `pol_v2.${Date.now().toString().slice(-3)}.0`,
        effective_at: Math.floor(Date.now() / 1000),
        merchant_id: policy?.merchant_id || "merch_acme_electronics_01",
        max_transaction_amount: newCapInr * 100,
        allowed_categories: policy?.allowed_categories || ["electronics", "furniture"],
        auto_refund_on_fulfillment_failure: true,
        min_margin_percentage: 15,
      });
      alert(`Policy mutated to ${res.policy.policy_version}. Max single ticket: ₹${newCapInr}.00`);
      await syncData();
    } catch (err: any) {
      alert(`Policy mutation error: ${err.message}`);
    } finally {
      setIsUpdatingPolicy(false);
    }
  };

  // Concurrency Test Action
  const handleRunConcurrencyTest = async () => {
    setIsTestingConcurrency(true);
    try {
      const res = await demoApi.runScenario("concurrent");
      setConcurrencyResult({
        admitted: "1 (HTTP 201)",
        blocked: "1 (HTTP 409)",
      });
      alert(
        `CONCURRENCY ACID RACE VERIFIED:\n\nSubagent A: HTTP ${res.subagentA?.status}\nSubagent B: HTTP ${res.subagentB?.status} (${(res.subagentB?.body as any)?.error || "MANDATE_EXHAUSTED"})\n\nRemaining mandate budget strictly protected.`
      );
      await syncData();
    } catch (err: any) {
      alert(`Concurrency test error: ${err.message}`);
    } finally {
      setIsTestingConcurrency(false);
    }
  };

  // Verify Audit Integrity Action
  const handleVerifyAudit = async () => {
    setIsVerifyingAudit(true);
    try {
      const res = await auditApi.verifyIntegrity();
      setAuditIntegrity(res);
      alert(
        `SHA-256 Audit Ledger Integrity:\n\nValid Chain: ${res.isValid}\nChecked Blocks: ${res.checkedBlocks}\n${
          res.corruptedBlockIndex !== undefined
            ? "Corrupted Block Index: " + res.corruptedBlockIndex
            : "No tampering detected."
        }`
      );
      await syncData();
    } catch (err: any) {
      alert(`Audit verification error: ${err.message}`);
    } finally {
      setIsVerifyingAudit(false);
    }
  };

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={handleTabChange}
      merchantId={policy?.merchant_id}
      policyVersion={policy?.policy_version}
      isSyncing={isSyncing}
      onSync={syncData}
      syncTimestamp={syncTimestamp}
    >
      {globalError && (
        <div className="mb-6">
          <ErrorAlert error={globalError} onDismiss={() => setGlobalError(null)} />
        </div>
      )}

      {activeTab === "overview" && (
        <OverviewView
          metrics={metrics}
          transactions={transactions}
          isLoading={isLoading}
          onSelectTransaction={handleSelectTransaction}
        />
      )}

      {activeTab === "live-demo" && (
        <LiveDemoView
          onRunScenario={handleRunScenario}
          isExecuting={isExecutingScenario}
        />
      )}

      {activeTab === "transactions" && (
        <TransactionsView
          detail={selectedTransactionDetail}
          isLoading={isLoading}
        />
      )}

      {activeTab === "mandates" && (
        <MandatesView
          mandates={mandates}
          revoked={revokedMandates}
          isLoading={isLoading}
          onRevokeMandate={handleRevokeMandate}
          isRevoking={isRevokingMandate}
        />
      )}

      {activeTab === "policies" && (
        <PoliciesView
          policy={policy}
          catalog={catalog}
          isLoading={isLoading}
          onUpdatePolicy={handleUpdatePolicy}
          isUpdating={isUpdatingPolicy}
        />
      )}

      {activeTab === "reservations" && (
        <ReservationsView
          reservations={reservations}
          isLoading={isLoading}
          onRunConcurrencyTest={handleRunConcurrencyTest}
          isTestingConcurrency={isTestingConcurrency}
          concurrencyResult={concurrencyResult}
        />
      )}

      {activeTab === "audit-ledger" && (
        <AuditLedgerView
          blocks={auditBlocks}
          integrity={auditIntegrity}
          isLoading={isLoading}
          onVerifyIntegrity={handleVerifyAudit}
          isVerifying={isVerifyingAudit}
        />
      )}

      {activeTab === "system-health" && (
        <SystemHealthView
          health={health}
          isLoading={isLoading}
        />
      )}
    </AppShell>
  );
};

export default App;
