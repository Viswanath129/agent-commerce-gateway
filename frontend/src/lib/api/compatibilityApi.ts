import { apiClient } from "./apiClient.js";
import type { CompatibilityMatrixResponse } from "./types.js";

export const compatibilityApi = {
  getMatrix: async (): Promise<CompatibilityMatrixResponse> => {
    return apiClient.get<CompatibilityMatrixResponse>("/dashboard/compatibility");
  },

  testAdapter: async (protocol: string): Promise<Record<string, unknown>> => {
    return apiClient.post<Record<string, unknown>>("/dashboard/compatibility/test-adapter", { protocol });
  },
};
