import { useState, useEffect, useCallback } from "react";
import { dashboardApi } from "../api/dashboardApi.js";
import { transactionApi } from "../api/transactionApi.js";
import { mandateApi } from "../api/mandateApi.js";
import { policyApi } from "../api/policyApi.js";
import { reservationApi } from "../api/reservationApi.js";
import { auditApi } from "../api/auditApi.js";
import { healthApi } from "../api/healthApi.js";
import { demoApi } from "../api/demoApi.js";
import { ApiError } from "../api/apiClient.js";
import type {
  DashboardMetrics,
  OrderSession,
  TransactionDetailResponse,
  BuyerMandate,
  RevokedMandate,
  MerchantPolicy,
  Reservation,
  AuditBlock,
  AuditIntegrityResponse,
  SystemHealthResponse,
  DemoScenarioType,
  DemoScenarioResult,
  RevokeMandateRequest,
  RevokeMandateResponse,
} from "../api/types.js";

/** 1. useDashboardMetrics */
export function useDashboardMetrics(pollIntervalMs = 5000) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await dashboardApi.getMetrics();
      setMetrics(data);
      setError(null);
    } catch (err: any) {
      setError(err instanceof ApiError ? err : new ApiError(err.message || "Failed to fetch metrics", 0));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    if (pollIntervalMs > 0) {
      const id = setInterval(fetchMetrics, pollIntervalMs);
      return () => clearInterval(id);
    }
  }, [fetchMetrics, pollIntervalMs]);

  return { metrics, isLoading, error, refetch: fetchMetrics };
}

/** 2. useTransactions */
export function useTransactions() {
  const [transactions, setTransactions] = useState<OrderSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await transactionApi.getTransactions();
      setTransactions(data.transactions || []);
      setError(null);
    } catch (err: any) {
      setError(err instanceof ApiError ? err : new ApiError(err.message, 0));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return { transactions, isLoading, error, refetch: fetchTransactions };
}

/** 3. useTransaction(id) */
export function useTransaction(intentId: string | null) {
  const [detail, setDetail] = useState<TransactionDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchDetail = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const data = await transactionApi.getTransactionDetail(id);
      setDetail(data);
      setError(null);
    } catch (err: any) {
      setError(err instanceof ApiError ? err : new ApiError(err.message, 0));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (intentId) {
      fetchDetail(intentId);
    } else {
      setDetail(null);
    }
  }, [intentId, fetchDetail]);

  return { detail, isLoading, error, refetch: () => intentId && fetchDetail(intentId) };
}

/** 4. useMandates */
export function useMandates() {
  const [mandates, setMandates] = useState<BuyerMandate[]>([]);
  const [revoked, setRevoked] = useState<RevokedMandate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRevoking, setIsRevoking] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchMandates = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await mandateApi.getMandates();
      setMandates(data.mandates || []);
      setRevoked(data.revoked || []);
      setError(null);
    } catch (err: any) {
      setError(err instanceof ApiError ? err : new ApiError(err.message, 0));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const revokeMandate = async (payload: RevokeMandateRequest): Promise<RevokeMandateResponse> => {
    setIsRevoking(true);
    try {
      const res = await mandateApi.revokeMandate(payload);
      await fetchMandates();
      return res;
    } finally {
      setIsRevoking(false);
    }
  };

  useEffect(() => {
    fetchMandates();
  }, [fetchMandates]);

  return { mandates, revoked, isLoading, isRevoking, error, refetch: fetchMandates, revokeMandate };
}

/** 5. usePolicies */
export function usePolicies() {
  const [policy, setPolicy] = useState<MerchantPolicy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchPolicy = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await policyApi.getPolicy();
      setPolicy(data.policy);
      setError(null);
    } catch (err: any) {
      setError(err instanceof ApiError ? err : new ApiError(err.message, 0));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updatePolicy = async (newPolicy: MerchantPolicy) => {
    setIsUpdating(true);
    try {
      const res = await policyApi.updatePolicy(newPolicy);
      setPolicy(res.policy);
      return res;
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  return { policy, isLoading, isUpdating, error, refetch: fetchPolicy, updatePolicy };
}

/** 6. useReservations */
export function useReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchReservations = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await reservationApi.getReservations();
      setReservations(data.reservations || []);
      setError(null);
    } catch (err: any) {
      setError(err instanceof ApiError ? err : new ApiError(err.message, 0));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  return { reservations, isLoading, error, refetch: fetchReservations };
}

/** 7. useAudit */
export function useAudit() {
  const [blocks, setBlocks] = useState<AuditBlock[]>([]);
  const [integrity, setIntegrity] = useState<AuditIntegrityResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchBlocks = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await auditApi.getAuditBlocks();
      setBlocks(data.blocks || []);
      setIntegrity(data.integrity || null);
      setError(null);
    } catch (err: any) {
      setError(err instanceof ApiError ? err : new ApiError(err.message, 0));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyIntegrity = async (): Promise<AuditIntegrityResponse> => {
    setIsVerifying(true);
    try {
      const res = await auditApi.verifyIntegrity();
      setIntegrity(res);
      return res;
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  return { blocks, integrity, isLoading, isVerifying, error, refetch: fetchBlocks, verifyIntegrity };
}

/** 8. useSystemHealth */
export function useSystemHealth(pollIntervalMs = 10000) {
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await healthApi.getHealth();
      setHealth(data);
      setError(null);
    } catch (err: any) {
      setError(err instanceof ApiError ? err : new ApiError(err.message, 0));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    if (pollIntervalMs > 0) {
      const id = setInterval(fetchHealth, pollIntervalMs);
      return () => clearInterval(id);
    }
  }, [fetchHealth, pollIntervalMs]);

  return { health, isLoading, error, refetch: fetchHealth };
}

/** 9. useDemoScenario */
export function useDemoScenario() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<DemoScenarioResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const executeScenario = async (scenario: DemoScenarioType): Promise<DemoScenarioResult> => {
    setIsExecuting(true);
    setError(null);
    try {
      const result = await demoApi.runScenario(scenario);
      setLastResult(result);
      return result;
    } catch (err: any) {
      const apiErr = err instanceof ApiError ? err : new ApiError(err.message, 0);
      setError(apiErr);
      throw apiErr;
    } finally {
      setIsExecuting(false);
    }
  };

  return { executeScenario, isExecuting, lastResult, error };
}
