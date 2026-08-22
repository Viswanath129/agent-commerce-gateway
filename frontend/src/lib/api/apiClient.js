export class ApiError extends Error {
    statusCode;
    errorCode;
    details;
    constructor(message, statusCode, errorCode, details) {
        super(message);
        this.name = "ApiError";
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.details = details;
    }
}
export class ApiClient {
    baseUrl;
    defaultTimeoutMs;
    constructor(baseUrl = "", defaultTimeoutMs = 10000) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.defaultTimeoutMs = defaultTimeoutMs;
    }
    setBaseUrl(url) {
        this.baseUrl = url.replace(/\/$/, "");
    }
    getBaseUrl() {
        return this.baseUrl;
    }
    buildUrl(endpoint, params) {
        const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
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
                url += (url.includes("?") ? "&" : "?") + queryString;
            }
        }
        return url;
    }
    async request(endpoint, options = {}) {
        const { timeoutMs = this.defaultTimeoutMs, params, headers, ...customConfig } = options;
        const url = this.buildUrl(endpoint, params);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const config = {
            ...customConfig,
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                ...headers,
            },
            signal: controller.signal,
        };
        try {
            const response = await fetch(url, config);
            clearTimeout(timeoutId);
            const isJson = response.headers.get("content-type")?.includes("application/json");
            const data = isJson ? await response.json() : await response.text();
            if (!response.ok) {
                const errorPayload = typeof data === "object" ? data : null;
                const errorMessage = errorPayload?.message || errorPayload?.error || `HTTP error ${response.status}: ${response.statusText}`;
                const errorCode = errorPayload?.error;
                const details = errorPayload?.details;
                throw new ApiError(errorMessage, response.status, errorCode, details);
            }
            return data;
        }
        catch (err) {
            clearTimeout(timeoutId);
            if (err instanceof ApiError) {
                throw err;
            }
            if (err instanceof Error && err.name === "AbortError") {
                throw new ApiError(`Request timeout after ${timeoutMs}ms`, 408, "TIMEOUT");
            }
            throw new ApiError(err instanceof Error ? err.message : "Network error", 0, "NETWORK_ERROR");
        }
    }
    get(endpoint, options) {
        return this.request(endpoint, { ...options, method: "GET" });
    }
    post(endpoint, body, options) {
        return this.request(endpoint, {
            ...options,
            method: "POST",
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    }
    put(endpoint, body, options) {
        return this.request(endpoint, {
            ...options,
            method: "PUT",
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    }
    delete(endpoint, options) {
        return this.request(endpoint, { ...options, method: "DELETE" });
    }
}
// Global default singleton instance
export const apiClient = new ApiClient();
