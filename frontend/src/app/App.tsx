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
  apiClient,
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

  // Loading & Action states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<{ status: 401 | 403, message: string } | null>(null);
  const [hasOperatorToken, setHasOperatorToken] = useState(() => apiClient.hasAuthToken());
  const [operatorToken, setOperatorToken] = useState('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncTimestamp, setSyncTimestamp] = useState<string>('');
  const [isExecutingScenario, setIsExecutingScenario] = useState<boolean>(false);
  const [isRevokingMandate, setIsRevokingMandate] = useState<boolean>(false);
  const [isUpdatingPolicy, setIsUpdatingPolicy] = useState<boolean>(false);
  const [isTestingConcurrency, setIsTestingConcurrency] = useState<boolean>(false);
  const [concurrencyResult, setConcurrencyResult] = useState<{ admitted: string; blocked: string } | null>(null);
  const [isVerifyingAudit, setIsVerifyingAudit] = useState<boolean>(false);

  // Unified Live Fetch Function (Zero-Mock from SQLite)
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
      if (err.statusCode === 401) {
        setAuthError({ status: 401, message: err.message || 'Authentication required' });
      } else if (err.statusCode === 403 && (err.errorCode === 'FORBIDDEN' || err.details?.error === 'FORBIDDEN' || err.message?.includes('Insufficient permissions'))) {
        setAuthError({ status: 403, message: 'Insufficient merchant scope.' });
      }
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
      if (err.statusCode === 401) {
        setAuthError({ status: 401, message: err.message || 'Authentication required' });
      } else if (err.statusCode === 403 && (err.errorCode === 'FORBIDDEN' || err.details?.error === 'FORBIDDEN' || err.message?.includes('Insufficient permissions'))) {
        setAuthError({ status: 403, message: 'Insufficient merchant scope.' });
      }
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
      if (err.statusCode === 401) {
        setAuthError({ status: 401, message: err.message || 'Authentication required' });
      } else if (err.statusCode === 403 && (err.errorCode === 'FORBIDDEN' || err.details?.error === 'FORBIDDEN' || err.message?.includes('Insufficient permissions'))) {
        setAuthError({ status: 403, message: 'Insufficient merchant scope.' });
      }
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
      if (err.statusCode === 401) {
        setAuthError({ status: 401, message: err.message || 'Authentication required' });
      } else if (err.statusCode === 403 && (err.errorCode === 'FORBIDDEN' || err.details?.error === 'FORBIDDEN' || err.message?.includes('Insufficient permissions'))) {
        setAuthError({ status: 403, message: 'Insufficient merchant scope.' });
      }
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
      if (err.statusCode === 401) {
        setAuthError({ status: 401, message: err.message || 'Authentication required' });
      } else if (err.statusCode === 403 && (err.errorCode === 'FORBIDDEN' || err.details?.error === 'FORBIDDEN' || err.message?.includes('Insufficient permissions'))) {
        setAuthError({ status: 403, message: 'Insufficient merchant scope.' });
      }
      throw err;
    } finally {
      setIsVerifyingAudit(false);
    }
  };

  if (!hasOperatorToken) {
    return (
      <div className="min-h-screen bg-[#10100F] flex items-center justify-center text-[#F2EEE4] font-mono p-6">
        <form className="w-full max-w-lg p-8 border border-[#302F2B] bg-[#181816] shadow-2xl space-y-6" onSubmit={(event) => {
          event.preventDefault();
          if (!operatorToken.trim()) return;
          apiClient.setAuthToken(operatorToken);
          setOperatorToken('');
          setHasOperatorToken(true);
        }}>
          <div className="space-y-2">
            <p className="text-[10px] tracking-[0.2em] text-[#C8B27A] uppercase">ACG Merchant Console</p>
            <h1 className="font-display text-2xl tracking-wider uppercase">Operator authentication required</h1>
            <p className="text-xs text-[#B8B3A7] leading-relaxed">Enter a server-issued merchant bearer token. It is held only for this browser session and is never compiled into the frontend.</p>
          </div>
          <input aria-label="Merchant bearer token" type="password" value={operatorToken} onChange={(event) => setOperatorToken(event.target.value)} className="w-full p-3 bg-[#10100F] border border-[#302F2B] text-sm" autoComplete="off" required />
          <button type="submit" className="w-full py-3 bg-[#C8B27A] text-[#10100F] font-semibold text-xs tracking-wider uppercase">Open control plane</button>
        </form>
      </div>
    );
  }

  if (authError) {
    const isAuth = authError.status === 401;
    const isForbidden = authError.status === 403;
    const title = isAuth ? 'AUTHENTICATION REQUIRED' : isForbidden ? 'ACCESS FORBIDDEN [SCOPE INSUFFICIENT]' : 'GATEWAY COMMUNICATION ERROR';
    const recoveryAction = isAuth 
      ? 'Enter a valid server-issued merchant bearer token. Browser builds never contain server-side credentials.'
      : 'Verify that your merchant admin role includes "merchant:read", "merchant:policy:write", and "merchant:mandate:revoke" privileges.';

    return (
      <div className="min-h-screen bg-[#10100F] flex flex-col items-center justify-center text-[#F2EEE4] font-mono p-6 text-center">
        <div className="w-full max-w-xl p-8 border border-[#302F2B] bg-[#181816] shadow-2xl space-y-6">
          <div className="flex items-center justify-center gap-3">
            <span className="w-3 h-3 bg-[#A76565] inline-block" />
            <h1 className="font-display text-2xl text-[#F2EEE4] tracking-wider uppercase font-semibold">
              {title}
            </h1>
          </div>

          <p className="text-xs text-[#B8B3A7] leading-relaxed">
            The Agent Commerce Gateway control plane requires authenticated merchant authority.
          </p>

          <div className="p-4 border border-[#302F2B] bg-[#10100F] text-left space-y-3 text-xs">
            <div>
              <span className="text-[10px] text-[#77746C] uppercase block tracking-wider">HTTP Status & Code</span>
              <span className="text-[#A76565] font-bold">HTTP {authError.status} // {isAuth ? 'UNAUTHORIZED' : 'FORBIDDEN'}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#77746C] uppercase block tracking-wider">Error Details</span>
              <code className="text-[#F2EEE4] text-[11px] block break-all font-mono">{authError.message}</code>
            </div>
            <div className="pt-2 border-t border-[#302F2B]">
              <span className="text-[10px] text-[#C8B27A] uppercase block tracking-wider font-semibold">Remediation Action</span>
              <span className="text-[#B8B3A7] text-[11px] leading-normal">{recoveryAction}</span>
            </div>
          </div>

          <button 
            onClick={() => { setAuthError(null); fetchAllData(); }}
            className="w-full py-3 bg-[#C8B27A] text-[#10100F] font-semibold text-xs tracking-wider uppercase hover:bg-[#E1D2A8] active:bg-[#B8A36C] transition-colors cursor-pointer"
          >
            RETRY GATEWAY CONNECTION
          </button>
        </div>
      </div>
    );
  }

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
