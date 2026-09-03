import type { FastifyRequest, FastifyReply } from "fastify";

// For hackathon simplicity, we map static bearer tokens to arrays of scopes.
// In a real system, these would be in a secure database or JWT claims.
const validTokens: Record<string, string[]> = {
  "secret_merchant_admin": ["merchant:read", "merchant:policy:write", "merchant:mandate:revoke", "merchant:refund", "audit:read", "audit:verify"],
  "secret_merchant_viewer": ["merchant:read", "audit:read"],
  "secret_audit_bot": ["audit:read", "audit:verify"],
};

export function requireScope(requiredScope: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      
      return reply.status(401).send({ error: "UNAUTHORIZED", message: "Missing or invalid Authorization header" });
    }

    const token = authHeader.substring(7);
    const scopes = validTokens[token];

    if (!scopes) {
      return reply.status(401).send({ error: "UNAUTHORIZED", message: "Invalid credentials" });
    }

    if (!scopes.includes(requiredScope)) {
      return reply.status(403).send({ error: "FORBIDDEN", message: `Insufficient permissions. Requires scope: ${requiredScope}` });
    }

    // Assign to request context
    (request as any).merchantAuthScopes = scopes;
  };
}
