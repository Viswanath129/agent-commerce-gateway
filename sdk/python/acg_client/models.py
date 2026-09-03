from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any

@dataclass
class BuyerMandate:
    mandate_id: str
    principal_public_key: str
    budget_limit: int  # in paise
    currency: str = "INR"
    merchant_whitelist: List[str] = field(default_factory=list)
    category_whitelist: List[str] = field(default_factory=list)
    expiry: int = 0
    signature: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = {
            "mandate_id": self.mandate_id,
            "principal_public_key": self.principal_public_key,
            "budget_limit": self.budget_limit,
            "currency": self.currency,
            "merchant_whitelist": self.merchant_whitelist,
            "category_whitelist": self.category_whitelist,
            "expiry": self.expiry,
        }
        if self.signature:
            d["signature"] = self.signature
        return d

@dataclass
class ProposedItem:
    sku: str
    quantity: int

    def to_dict(self) -> Dict[str, Any]:
        return {"sku": self.sku, "quantity": self.quantity}

@dataclass
class CanonicalIntent:
    intent_id: str
    client_nonce: str
    timestamp: int
    mandate: BuyerMandate
    proposed_items: List[ProposedItem]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "intent_id": self.intent_id,
            "client_nonce": self.client_nonce,
            "timestamp": self.timestamp,
            "mandate": self.mandate.to_dict(),
            "proposed_items": [item.to_dict() for item in self.proposed_items],
        }

@dataclass
class MerchantPolicy:
    policy_version: str
    effective_at: int
    merchant_id: str
    max_transaction_amount: int
    allowed_categories: List[str]
    auto_refund_on_fulfillment_failure: bool = True
    min_margin_percentage: int = 15

    def to_dict(self) -> Dict[str, Any]:
        return {
            "policy_version": self.policy_version,
            "effective_at": self.effective_at,
            "merchant_id": self.merchant_id,
            "max_transaction_amount": self.max_transaction_amount,
            "allowed_categories": self.allowed_categories,
            "auto_refund_on_fulfillment_failure": self.auto_refund_on_fulfillment_failure,
            "min_margin_percentage": self.min_margin_percentage,
        }

@dataclass
class CheckoutResponse:
    status: str
    intent_id: str
    receipt: str
    razorpay_order_id: str
    amount_paise: int
    currency: str
    policy_version: str
    reservation_id: str
    items: List[Dict[str, Any]] = field(default_factory=list)
