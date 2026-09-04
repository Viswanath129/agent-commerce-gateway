import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { useAppRouter } from './router.js';
import {
  dashboardApi,
  transactionApi,
  mandateApi,
  policyApi,
  reservationApi,
  auditApi,
  healthApi,
  demoApi,
  compatibilityApi,
} from '../lib/api/index.js';
import type {
  DashboardMetrics,
  OrderSession,
  TransactionDetailResponse,
  BuyerMandate,
  RevokedMandate,
  MerchantPolicy,
  CatalogItem,
  Reservation,
  AuditBlock,
  AuditIntegrityResponse,
  SystemHealthResponse,
  DemoScenarioType,
  DemoScenarioResult,
  CompatibilityMatrixResponse,
  TabId,
} from '../types/index.js';

// Feature Views
import { OverviewView } from '../features/overview/OverviewView.js';
import { LiveDemoView } from '../features/live-demo/LiveDemoView.js';
import { TransactionsView } from '../features/transactions/TransactionsView.js';
import { MandatesView } from '../features/mandates/MandatesView.js';
import { PoliciesView } from '../features/policies/PoliciesView.js';
import { ReservationsView } from '../features/reservations/ReservationsView.js';
import { AuditLedgerView } from '../features/audit/AuditLedgerView.js';
import { SystemHealthView } from '../features/system-health/SystemHealthView.js';
import { AgentCompatibilityView } from '../features/compatibility/AgentCompatibilityView.js';

export const App: React.FC = () => {
  const { activeTab, selectedParam, navigate } = useAppRouter();

  // Control plane state
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [transactions, setTransactions] = useState<OrderSession[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<TransactionDetailResponse | null>(null);
  const [mandates, setMandates] = useState<BuyerMandate[]>([]);
  const [revokedMandates, setRevokedMandates] = useState<RevokedMandate[]>([]);
  const [policy, setPolicy] = useState<MerchantPolicy | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [auditBlocks, setAuditBlocks] = useState<AuditBlock[]>([]);
  const [auditIntegrity, setAuditIntegrity] = useState<AuditIntegrityResponse | null>(null);
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [matrix, setMatrix] = useState<CompatibilityMatrixResponse | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncTimestamp, setSyncTimestamp] = useState<string>('Just now');
  const [isExecutingScenario, setIsExecutingScenario] = useState<boolean>(false);
  const [isRevokingMandate, setIsRevokingMandate] = useState<boolean>(false);
  const [isUpdatingPolicy, setIsUpdatingPolicy] = useState<boolean>(false);
  const [isTestingConcurrency, setIsTestingConcurrency] = useState<boolean>(false);
  const [concurrencyResult, setConcurrencyResult] = useState<{ admitted: string; blocked: string } | null>(null);
  const [isVerifyingAudit, setIsVerifyingAudit] = useState<boolean>(false);

  // Sync gateway data from real backend endpoints
  const fetchAllData = useCallback(async () => {
    try {
      const [
        metricsData,
        txData,
        mandatesData,
        policyData,
        catalogData,
        reservationsData,
        auditData,
        healthData,
        matrixData,
      ] = await Promise.all([
        dashboardApi.getMetrics().catch(() => null),
        transactionApi.getTransactions().catch(() => ({ transactions: [] })),
        mandateApi.getMandates().catch(() => ({ mandates: [], revoked: [] })),
        policyApi.getPolicy().catch(() => ({ policy: null })),
        policyApi.getCatalog().catch(() => ({ items: [] })),
        reservationApi.getReservations().catch(() => ({ reservations: [] })),
        auditApi.getAuditBlocks().catch(() => ({ blocks: [], integrity: null })),
        healthApi.getHealth().catch(() => null),
        compatibilityApi.getMatrix().catch(() => null),
      ]);

      if (metricsData) setMetrics(metricsData);
      if (txData?.transactions) setTransactions(txData.transactions);
      if (mandatesData?.mandates) setMandates(mandatesData.mandates);
      if (mandatesData?.revoked) setRevokedMandates(mandatesData.revoked);
      if (policyData?.policy) setPolicy(policyData.policy);
      if (catalogData?.items) setCatalog(catalogData.items);
      if (reservationsData?.reservations) setReservations(reservationsData.reservations);
      if (auditData?.blocks) setAuditBlocks(auditData.blocks);
      if (auditData?.integrity) setAuditIntegrity(auditData.integrity);
      if (healthData) setHealth(healthData);
      if (matrixData) setMatrix(matrixData);

      setSyncTimestamp(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error('Failed to sync live gateway data:', err);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, []);

  // Fetch transaction details when route has intentId
  useEffect(() => {
    if (selectedParam) {
      transactionApi.getTransactionDetail(selectedParam)
        .then(setSelectedDetail)
        .catch(() => setSelectedDetail(null));
    } else {
      setSelectedDetail(null);
    }
  }, [selectedParam]);

  // Initial load and polling every 4 seconds
  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 4000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  // Manual Sync handler
  const handleManualSync = async () => {
    setIsSyncing(true);
    await fetchAllData();
  };

  // Scenario runner for Screen 02
  const handleRunScenario = async (scenario: DemoScenarioType): Promise<DemoScenarioResult> => {
    setIsExecutingScenario(true);
    try {
      const res = await demoApi.runScenario(scenario);
      await fetchAllData();
      return res;
    } catch (err: any) {
      console.error('Scenario error:', err);
      throw err;
    } finally {
      setIsExecutingScenario(false);
    }
  };

  // Revoke mandate handler for Screen 04
  const handleRevokeMandate = async (mandateId: string) => {
    setIsRevokingMandate(true);
    try {
      await mandateApi.revokeMandate({
        mandate_id: mandateId,
        reason: 'Revoked by Human Principal via ACG Web Console',
      });
      await fetchAllData();
    } catch (err: any) {
      console.error('Mandate revocation error:', err);
      throw err;
    } finally {
      setIsRevokingMandate(false);
    }
  };

  // Mutate policy handler for Screen 05 (Visual Studio & Quick Cap)
  const handleUpdatePolicy = async (policyOrCap: number | MerchantPolicy) => {
    setIsUpdatingPolicy(true);
    try {
      if (typeof policyOrCap === 'number') {
        const versionNum = Date.now().toString().slice(-3);
        await policyApi.updatePolicy({
          policy_version: `pol_v2.${versionNum}.0`,
          effective_at: Math.floor(Date.now() / 1000),
          merchant_id: policy?.merchant_id || 'merch_acme_electronics_01',
          max_transaction_amount: policyOrCap * 100,
          allowed_categories: policy?.allowed_categories || ['electronics', 'furniture'],
          auto_refund_on_fulfillment_failure: policy?.auto_refund_on_fulfillment_failure ?? true,
          min_margin_percentage: policy?.min_margin_percentage || 15,
        });
      } else {
        await policyApi.updatePolicy(policyOrCap);
      }
      await fetchAllData();
    } catch (err: any) {
      console.error('Policy update error:', err);
      throw err;
    } finally {
      setIsUpdatingPolicy(false);
    }
  };

  // Concurrency test for Screen 06
  const handleRunConcurrencyTest = async () => {
    setIsTestingConcurrency(true);
    try {
      const res = await demoApi.runScenario('concurrent');
      setConcurrencyResult({
        admitted: `1 (HTTP ${res.subagentA?.status || 201})`,
        blocked: `1 (HTTP ${res.subagentB?.status || 409})`,
      });
      await fetchAllData();
    } catch (err: any) {
      console.error('Concurrency error:', err);
      throw err;
    } finally {
      setIsTestingConcurrency(false);
    }
  };

  // Audit integrity check for Screen 07
  const handleVerifyAudit = async () => {
    setIsVerifyingAudit(true);
    try {
      const res = await auditApi.verifyIntegrity();
      setAuditIntegrity(res);
      await fetchAllData();
    } catch (err: any) {
      console.error('Audit verification error:', err);
      throw err;
    } finally {
      setIsVerifyingAudit(false);
    }
  };

  return (
    <AppShell
      activeTab={activeTab}
      onSelectTab={(tab: TabId) => navigate(tab)}
      onSync={handleManualSync}
      isSyncing={isSyncing}
      syncTimestamp={syncTimestamp}
      merchantId={policy?.merchant_id || 'merch_acme_electronics_01'}
      policyVersion={policy?.policy_version || 'pol_v1.0.0'}
      isDbConnected={health?.components?.database?.status === 'CONNECTED'}
    >
      {activeTab === 'overview' && (
        <OverviewView
          metrics={metrics}
          transactions={transactions}
          isLoading={isLoading}
          onSelectTransaction={(id) => navigate('transactions', id)}
        />
      )}

      {activeTab === 'live-demo' && (
        <LiveDemoView
          onRunScenario={handleRunScenario}
          isExecuting={isExecutingScenario}
        />
      )}

      {activeTab === 'transactions' && (
        <TransactionsView
          transactions={transactions}
          selectedDetail={selectedDetail}
          isLoading={isLoading}
          onSelectTransaction={(id) => navigate('transactions', id)}
          onBackToList={() => navigate('transactions')}
        />
      )}

      {activeTab === 'mandates' && (
        <MandatesView
          mandates={mandates}
          revoked={revokedMandates}
          isLoading={isLoading}
          onRevokeMandate={handleRevokeMandate}
          isRevoking={isRevokingMandate}
        />
      )}

      {activeTab === 'policies' && (
        <PoliciesView
          policy={policy}
          catalog={catalog}
          isLoading={isLoading}
          onUpdatePolicy={handleUpdatePolicy}
          isUpdating={isUpdatingPolicy}
        />
      )}

      {activeTab === 'reservations' && (
        <ReservationsView
          reservations={reservations}
          isLoading={isLoading}
          onRunConcurrencyTest={handleRunConcurrencyTest}
          isTestingConcurrency={isTestingConcurrency}
          concurrencyResult={concurrencyResult}
        />
      )}

      {activeTab === 'audit-ledger' && (
        <AuditLedgerView
          blocks={auditBlocks}
          integrity={auditIntegrity}
          isLoading={isLoading}
          onVerifyIntegrity={handleVerifyAudit}
          isVerifying={isVerifyingAudit}
        />
      )}

      {activeTab === 'system-health' && (
        <SystemHealthView
          health={health}
          isLoading={isLoading}
        />
      )}

      {activeTab === 'agent-compatibility' && (
        <AgentCompatibilityView
          matrix={matrix}
          onRefresh={fetchAllData}
        />
      )}
    </AppShell>
  );
};
