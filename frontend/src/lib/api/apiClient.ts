/**
 * Hardened ACG ApiClient
 * Passes administrative bearer credentials for control plane actions
 * Adheres strictly to the ZERO-MOCK contract
 */

import type { ApiErrorPayload } from './types.js';

export class ApiError extends Error {
  public statusCode: number;
  public errorCode?: string;
  public details?: Record<string, unknown>;

  constructor(message: string, statusCode: number, errorCode?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  params?: Record<string, string | number | boolean | undefined>;
}

export class ApiClient {
  private baseUrl: string;
  private defaultTimeoutMs: number;
  private defaultAuthToken: string;

  constructor(baseUrl: string = '', defaultTimeoutMs: number = 10000, defaultAuthToken: string = '') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.defaultTimeoutMs = defaultTimeoutMs;
    // For LOCAL DEVELOPMENT only, allow Vite env token.
    this.defaultAuthToken = defaultAuthToken || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ACG_MERCHANT_TOKEN) || '';
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    let url = `${this.baseUrl}${cleanEndpoint}`;

    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      }
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }

    return url;
  }

  public async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { timeoutMs = this.defaultTimeoutMs, params, headers, ...customConfig } = options;
    const url = this.buildUrl(endpoint, params);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(headers as Record<string, string>),
    };

    // Only attach merchant auth to protected control-plane routes
    const isProtected = endpoint.startsWith('/dashboard') || endpoint.startsWith('/v1/merchant') || endpoint.startsWith('/v1/mandates/revoke');
    if (isProtected && this.defaultAuthToken) {
      reqHeaders['Authorization'] = `Bearer ${this.defaultAuthToken}`;
    }

    const config: RequestInit = {
      ...customConfig,
      headers: reqHeaders,
      signal: controller.signal,
    };

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);

      const isJson = response.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        const errorPayload = typeof data === 'object' ? (data as ApiErrorPayload) : null;
        const errorMessage = errorPayload?.message || errorPayload?.error || `HTTP error ${response.status}: ${response.statusText}`;
        const errorCode = errorPayload?.error;
        const details = errorPayload?.details;

        throw new ApiError(errorMessage, response.status, errorCode, details);
      }

      return data as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof ApiError) {
        throw err;
      }

      if (err instanceof Error && err.name === 'AbortError') {
        throw new ApiError(`Request timeout after ${timeoutMs}ms`, 408, 'TIMEOUT');
      }

      throw new ApiError(err instanceof Error ? err.message : 'Network error', 0, 'NETWORK_ERROR');
    }
  }

  public get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
