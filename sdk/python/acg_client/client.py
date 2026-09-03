import time
import uuid
import secrets
import hmac
import hashlib
import json
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional
from .models import BuyerMandate, ProposedItem, CanonicalIntent, MerchantPolicy, CheckoutResponse
from .crypto import sign_mandate

class ACGError(Exception):
    def __init__(self, status_code: int, error_code: str, message: str):
        super().__init__(f"[{status_code}] {error_code}: {message}")
        self.status_code = status_code
        self.error_code = error_code
        self.message = message

class ACGClient:
    def __init__(self, base_url: str = "http://localhost:3000", api_token: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self.api_token = api_token

    def _request(self, method: str, path: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"

        data = json.dumps(payload).encode('utf-8') if payload is not None else None
        req = urllib.request.Request(url, data=data, headers=headers, method=method)

        try:
            with urllib.request.urlopen(req) as resp:
                resp_body = resp.read().decode('utf-8')
                return json.loads(resp_body) if resp_body else {}
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8')
            try:
                err_json = json.loads(err_body)
                error_code = err_json.get("error", "HTTP_ERROR")
                message = err_json.get("message", err_body)
            except Exception:
                error_code = "HTTP_ERROR"
                message = err_body
            raise ACGError(e.code, error_code, message) from None

    def get_health(self) -> Dict[str, Any]:
        return self._request("GET", "/dashboard/health")

    def get_catalog(self) -> Dict[str, Any]:
        return self._request("GET", "/catalog")

    def get_policy(self) -> Dict[str, Any]:
        return self._request("GET", "/dashboard/policies")

    def update_policy(self, policy: MerchantPolicy) -> Dict[str, Any]:
        return self._request("PUT", "/v1/merchant/policy", policy.to_dict())

    def checkout(
        self,
        mandate: BuyerMandate,
        private_key_hex: str,
        items: List[ProposedItem],
        intent_id: Optional[str] = None
    ) -> CheckoutResponse:
        if not mandate.signature:
            mandate.signature = sign_mandate(mandate.to_dict(), private_key_hex)

        intent = CanonicalIntent(
            intent_id=intent_id or str(uuid.uuid4()),
            client_nonce=secrets.token_hex(16),
            timestamp=int(time.time()),
            mandate=mandate,
            proposed_items=items
        )

        resp = self._request("POST", "/v1/agent/checkout", intent.to_dict())
        return CheckoutResponse(
            status=resp.get("status", ""),
            intent_id=resp.get("intent_id", ""),
            receipt=resp.get("receipt", ""),
            razorpay_order_id=resp.get("razorpay_order_id", ""),
            amount_paise=resp.get("amount_paise", 0),
            currency=resp.get("currency", "INR"),
            policy_version=resp.get("policy_version", ""),
            reservation_id=resp.get("reservation_id", ""),
            items=resp.get("items", [])
        )

    def revoke_mandate(self, mandate_id: str, reason: str = "Revoked by merchant/user") -> Dict[str, Any]:
        return self._request("POST", "/v1/mandates/revoke", {"mandate_id": mandate_id, "reason": reason})

    def get_audit_trajectory(self, intent_id: str) -> Dict[str, Any]:
        return self._request("GET", f"/audit/{intent_id}")

    def verify_webhook(self, raw_body: str, signature: str, secret: str) -> bool:
        expected = hmac.new(secret.encode('utf-8'), raw_body.encode('utf-8'), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)
