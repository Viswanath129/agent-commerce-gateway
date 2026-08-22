import { useState, useEffect, useCallback } from "react";
import { policyApi } from "../api/policyApi.js";
import { ApiError } from "../api/apiClient.js";
import type { CatalogItem } from "../api/types.js";

export interface UseCatalogResult {
  items: CatalogItem[];
  merchantId: string;
  policyVersion: string;
  isLoading: boolean;
  error: ApiError | Error | null;
  refetch: () => Promise<void>;
  getItemBySku: (sku: string) => CatalogItem | undefined;
  getAvailableStock: (sku: string) => number;
  isItemInStock: (sku: string, requiredQuantity?: number) => boolean;
}

/**
 * Custom hook to fetch and interact with the authoritative Merchant Catalog.
 */
export function useCatalog(autoFetch = true): UseCatalogResult {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [merchantId, setMerchantId] = useState<string>("");
  const [policyVersion, setPolicyVersion] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(autoFetch);
  const [error, setError] = useState<ApiError | Error | null>(null);

  const fetchCatalog = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await policyApi.getCatalog();
      setItems(data.items || []);
      setMerchantId(data.merchant_id || "");
      setPolicyVersion(data.policy_version || "");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err);
      } else if (err instanceof Error) {
        setError(err);
      } else {
        setError(new Error("Unknown error while fetching catalog"));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchCatalog();
    }
  }, [autoFetch, fetchCatalog]);

  const getItemBySku = useCallback(
    (sku: string): CatalogItem | undefined => {
      return items.find((item) => item.sku.toLowerCase() === sku.toLowerCase());
    },
    [items]
  );

  const getAvailableStock = useCallback(
    (sku: string): number => {
      const item = getItemBySku(sku);
      return item?.available_stock ?? 0;
    },
    [getItemBySku]
  );

  const isItemInStock = useCallback(
    (sku: string, requiredQuantity = 1): boolean => {
      const stock = getAvailableStock(sku);
      return stock >= requiredQuantity;
    },
    [getAvailableStock]
  );

  return {
    items,
    merchantId,
    policyVersion,
    isLoading,
    error,
    refetch: fetchCatalog,
    getItemBySku,
    getAvailableStock,
    isItemInStock,
  };
}
