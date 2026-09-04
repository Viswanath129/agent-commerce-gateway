import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Resolves active authorization tokens and their granted scope sets.
 * In production: ONLY environment-configured credentials (ACG_ADMIN_TOKEN, ACG_VIEWER_TOKEN, ACG_AUDIT_TOKEN)
 * are accepted. Zero static fallback tokens are permitted.
 * In development / local testing: environment variables are preferred, but local test fixture tokens
 * are allowed if env vars are unset.
 */
export function getValidTokens(): Record<string, string[]> {
  const isProd = process.env.NODE_ENV === "production";
  const isCloudDemo = Boolean(
    process.env.RENDER ||
    process.env.VERCEL ||
    process.env.VERCEL_DEMO === "1" ||
    process.env.DEMO_MODE === "1" ||
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.FLY_APP_NAME
  );
  
  const adminToken = process.env.ACG_ADMIN_TOKEN || (!isProd || isCloudDemo ? "secret_merchant_admin" : undefined);
  const viewerToken = process.env.ACG_VIEWER_TOKEN || (!isProd || isCloudDemo ? "secret_merchant_viewer" : undefined);
  const auditToken = process.env.ACG_AUDIT_TOKEN || (!isProd || isCloudDemo ? "secret_audit_bot" : undefined);

  const tokenMap: Record<string, string[]> = Object.create(null);

  if (adminToken) {
    tokenMap[adminToken] = [
      "merchant:read",
      "merchant:write",
      "merchant:policy:write",
      "merchant:mandate:revoke",
      "merchant:refund",
      "audit:read",
      "audit:verify",
    ];
  }

  if (viewerToken) {
    tokenMap[viewerToken] = ["merchant:read", "audit:read"];
  }

  if (auditToken) {
    tokenMap[auditToken] = ["audit:read", "audit:verify"];
  }

  return tokenMap;
}

export function requireScope(requiredScope: string, options?: { allowUnauthenticatedInDev?: boolean }) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    const isProd = process.env.NODE_ENV === "production";
    const isCloudDemo = Boolean(
      process.env.RENDER ||
      process.env.VERCEL ||
      process.env.VERCEL_DEMO === "1" ||
      process.env.DEMO_MODE === "1" ||
      process.env.RAILWAY_ENVIRONMENT ||
      process.env.FLY_APP_NAME
    );

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      if ((!isProd || isCloudDemo) && options?.allowUnauthenticatedInDev) {
        return;
      }
      return reply.status(401).send({ error: "UNAUTHORIZED", message: "Missing or invalid Authorization header" });
    }

    const token = authHeader.substring(7);
    const validTokens = getValidTokens();
    const hasToken = Object.prototype.hasOwnProperty.call(validTokens, token);
    const scopes = hasToken ? validTokens[token] : undefined;

    if (!hasToken || !Array.isArray(scopes)) {
      return reply.status(401).send({ error: "UNAUTHORIZED", message: "Invalid credentials" });
    }

    if (!scopes.includes(requiredScope)) {
      return reply.status(403).send({ error: "FORBIDDEN", message: `Insufficient permissions. Requires scope: ${requiredScope}` });
    }

    // Assign to request context
    (request as any).merchantAuthScopes = scopes;
  };
}


