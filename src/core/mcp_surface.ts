import type { PolicyDecisionPoint } from "./pdp.js";
import type { AgentPrincipalRegistry } from "./agent_principal.js";
import type { AuditLedger } from "../store/audit.js";
import type { CanonicalIntent, MerchantPolicy } from "./types.js";

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export class ACGMcpToolSurface {
  private pdp: PolicyDecisionPoint;
  private principalRegistry: AgentPrincipalRegistry;
  private auditLedger: AuditLedger;

  constructor(pdp: PolicyDecisionPoint, principalRegistry: AgentPrincipalRegistry, auditLedger: AuditLedger) {
    this.pdp = pdp;
    this.principalRegistry = principalRegistry;
    this.auditLedger = auditLedger;
  }

  public listTools(): MCPToolDefinition[] {
    return [
      {
        name: "authorize_financial_action",
        description: "Evaluates and authorizes an agent-originated commercial financial intent through the ACG control plane.",
        inputSchema: {
          type: "object",
          properties: {
            intent: { type: "object", description: "CanonicalFinancialIntent payload" },
            agent_id: { type: "string" },
          },
          required: ["intent"],
        },
      },
      {
        name: "simulate_financial_action",
        description: "Dry-runs financial authorization without moving funds or modifying inventory state.",
        inputSchema: {
          type: "object",
          properties: {
            intent: { type: "object", description: "CanonicalFinancialIntent payload" },
            agent_id: { type: "string" },
          },
          required: ["intent"],
        },
      },
      {
        name: "get_authorization_decision",
        description: "Retrieves a historical PDP decision and its cryptographic authorization evidence.",
        inputSchema: {
          type: "object",
          properties: {
            decision_id: { type: "string" },
          },
          required: ["decision_id"],
        },
      },
      {
        name: "get_agent_capabilities",
        description: "Retrieves authorized capabilities and spend bounds for a registered agent principal.",
        inputSchema: {
          type: "object",
          properties: {
            agent_id: { type: "string" },
          },
          required: ["agent_id"],
        },
      },
      {
        name: "get_policy",
        description: "Retrieves the active merchant policy constraints and rules.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_audit_record",
        description: "Retrieves tamper-evident SHA-256 audit ledger trajectory for an intent.",
        inputSchema: {
          type: "object",
          properties: {
            intent_id: { type: "string" },
          },
          required: ["intent_id"],
        },
      },
    ];
  }

  public async callTool(name: string, args: any, activePolicy: MerchantPolicy): Promise<any> {
    switch (name) {
      case "simulate_financial_action": {
        const intent: CanonicalIntent = args.intent;
        const agentId: string = args.agent_id || "native-llm-agent";
        return this.pdp.simulate(intent, activePolicy, agentId);
      }
      case "authorize_financial_action": {
        const intent: CanonicalIntent = args.intent;
        const agentId: string = args.agent_id || "native-llm-agent";
        return this.pdp.evaluateIntent(intent, activePolicy, agentId);
      }
      case "get_authorization_decision": {
        if (!args.decision_id) {
          throw new Error("Missing required argument: 'decision_id'");
        }
        const dec = this.pdp.getDecision(args.decision_id);
        if (!dec) {
          throw new Error(`Decision '${args.decision_id}' not found`);
        }
        return dec;
      }
      case "get_agent_capabilities": {
        return {
          agent: this.principalRegistry.getPrincipal(args.agent_id),
          capabilities: this.principalRegistry.getCapabilities(args.agent_id),
        };
      }
      case "get_policy": {
        return { policy: activePolicy };
      }
      case "get_audit_record": {
        return {
          intent_id: args.intent_id,
          trajectory: this.auditLedger.getTrajectory(args.intent_id),
        };
      }
      default:
        throw new Error(`Unsupported MCP tool: '${name}'`);
    }
  }
}
