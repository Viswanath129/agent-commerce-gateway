export type FinancialState =
  | "INTENT_CREATED"
  | "AUTHORITY_VERIFIED"
  | "POLICY_APPROVED"
  | "REQUIRE_CONFIRMATION"
  | "CONFIRMED"
  | "RESERVED"
  | "ORDER_CREATED"
  | "PAYMENT_PENDING"
  | "CAPTURED"
  | "RECONCILED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED"
  | "REVERSED"
  | "REFUNDED";

export interface StateTransitionResult {
  valid: boolean;
  from: FinancialState | null;
  to: FinancialState;
  reason?: string;
}

export class FinancialStateMachine {
  // Formal Transition Map
  private static readonly VALID_TRANSITIONS: Record<FinancialState, FinancialState[]> = {
    INTENT_CREATED: ["AUTHORITY_VERIFIED", "REJECTED", "EXPIRED"],
    AUTHORITY_VERIFIED: ["POLICY_APPROVED", "REQUIRE_CONFIRMATION", "REJECTED", "EXPIRED"],
    REQUIRE_CONFIRMATION: ["CONFIRMED", "REJECTED", "EXPIRED", "CANCELLED"],
    CONFIRMED: ["POLICY_APPROVED", "REJECTED"],
    POLICY_APPROVED: ["RESERVED", "REJECTED"],
    RESERVED: ["ORDER_CREATED", "CANCELLED", "EXPIRED", "REVERSED"],
    ORDER_CREATED: ["PAYMENT_PENDING", "CAPTURED", "CANCELLED", "EXPIRED"],
    PAYMENT_PENDING: ["CAPTURED", "CANCELLED", "EXPIRED", "REVERSED"],
    CAPTURED: ["RECONCILED", "REFUNDED", "REVERSED"],
    RECONCILED: ["REFUNDED"],
    REJECTED: [],
    EXPIRED: [],
    CANCELLED: [],
    REVERSED: [],
    REFUNDED: [],
  };

  public static validateTransition(from: FinancialState | null, to: FinancialState): StateTransitionResult {
    if (from === null) {
      if (to === "INTENT_CREATED") {
        return { valid: true, from, to };
      }
      return {
        valid: false,
        from,
        to,
        reason: `Initial state must be INTENT_CREATED, received '${to}'`,
      };
    }

    const allowed = this.VALID_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      return {
        valid: false,
        from,
        to,
        reason: `Illegal financial state transition from '${from}' to '${to}'`,
      };
    }

    return { valid: true, from, to };
  }
}
