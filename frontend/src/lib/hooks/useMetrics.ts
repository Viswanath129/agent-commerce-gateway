import { useState, useEffect, useCallback } from "react";
import { dashboardApi } from "../api/dashboardApi.js";
import { ApiError } from "../api/apiClient.js";
import type { DashboardMetrics } from "../api/types.js";

export interface UseMetricsResult {
  metrics: DashboardMetrics | null;
  isLoading: boolean;
  error: ApiError | Error | null;
  refetch: () => Promise<void>;
}

export function useMetrics(pollIntervalMs?: number): UseMetricsResult {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | Error | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await dashboardApi.getMetrics();
      setMetrics(data);
      setError(null);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err);
      } else if (err instanceof Error) {
        setError(err);
      } else {
        setError(new Error("Failed to fetch dashboard metrics"));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    if (pollIntervalMs && pollIntervalMs > 0) {
      const interval = setInterval(fetchMetrics, pollIntervalMs);
      return () => clearInterval(interval);
    }
  }, [fetchMetrics, pollIntervalMs]);

  return { metrics, isLoading, error, refetch: fetchMetrics };
}
