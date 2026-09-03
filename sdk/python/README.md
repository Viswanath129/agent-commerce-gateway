# Agent Commerce Gateway (ACG) — Python SDK

Official Python client library for merchant control planes and autonomous AI agents transacting on Razorpay.

## Features
- Cryptographic Ed25519 Mandate Generation & Signing
- Autonomous Agent Intent Submission (`/v1/agent/checkout`)
- Dynamic Merchant Policy DSL Mutation (`PUT /v1/merchant/policy`)
- Tamper-Evident SHA-256 Audit Trajectory Inspection
- Webhook HMAC-SHA256 Signature Verification

## Installation
```bash
pip install ./sdk/python
```

## Quick Start
```python
import time
from acg_client import ACGClient, BuyerMandate, ProposedItem, generate_keypair

client = ACGClient(base_url="http://localhost:3000")
pub_hex, priv_hex = generate_keypair()
mandate = BuyerMandate(
    mandate_id="man_buyer_101",
    principal_public_key=pub_hex,
    budget_limit=500000,
    category_whitelist=["electronics"],
    expiry=int(time.time()) + 3600
)

order = client.checkout(
    mandate=mandate,
    private_key_hex=priv_hex,
    items=[ProposedItem(sku="SKU-MOUSE-PRO", quantity=1)]
)
print("Order created:", order.razorpay_order_id)
```
