export interface AgentCapabilitiesDiscovery {
  agentId: string;
  supportedActions: string[];
  supportedCurrencies: string[];
  supportedProtocols: string[];
  maxTransactionPaise: number;
}

export interface MerchantCapabilitiesDiscovery {
  merchantId: string;
  acceptedActions: string[];
  acceptedCurrencies: string[];
  supportedRails: string[];
  policyConstraints: {
    maxTransactionPaise: number;
    allowedCategories: string[];
    confirmationThresholdPaise: number;
  };
}

export interface NegotiatedCapabilities {
  status: "COMPATIBLE" | "INCOMPATIBLE";
  negotiatedActions: string[];
  negotiatedCurrencies: string[];
  effectiveTransactionLimitPaise: number;
  confirmationRequiredAbovePaise: number;
  disclaimer: "Negotiation establishes protocol compatibility only. Authorization requires explicit mandate and PDP approval.";
}

export class CapabilityNegotiator {
  public static negotiate(
    agent: AgentCapabilitiesDiscovery,
    merchant: MerchantCapabilitiesDiscovery
  ): NegotiatedCapabilities {
    const negotiatedActions = agent.supportedActions.filter((a) =>
      merchant.acceptedActions.includes(a) || merchant.acceptedActions.includes("*")
    );

    const negotiatedCurrencies = agent.supportedCurrencies.filter((c) =>
      merchant.acceptedCurrencies.includes(c) || merchant.acceptedCurrencies.includes("*")
    );

    const effectiveTransactionLimitPaise = Math.min(
      agent.maxTransactionPaise,
      merchant.policyConstraints.maxTransactionPaise
    );

    const isCompatible =
      negotiatedActions.length > 0 &&
      negotiatedCurrencies.length > 0 &&
      effectiveTransactionLimitPaise > 0;

    return {
      status: isCompatible ? "COMPATIBLE" : "INCOMPATIBLE",
      negotiatedActions,
      negotiatedCurrencies,
      effectiveTransactionLimitPaise,
      confirmationRequiredAbovePaise: merchant.policyConstraints.confirmationThresholdPaise,
      disclaimer: "Negotiation establishes protocol compatibility only. Authorization requires explicit mandate and PDP approval.",
    };
  }
}
