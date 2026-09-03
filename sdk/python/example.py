import time
from acg_client import ACGClient, BuyerMandate, ProposedItem, generate_keypair

def main():
    print("=== ACG PYTHON SDK LIVE DEMO ===")
    client = ACGClient("http://localhost:3000")

    try:
        health = client.get_health()
        print(f"[*] Subsystem Status: {health.get('status')}")
    except Exception as e:
        print(f"[*] Gateway connectivity note: {e}")

    pub_hex, priv_hex = generate_keypair()
    mandate = BuyerMandate(
        mandate_id=f"man_py_{int(time.time())}",
        principal_public_key=pub_hex,
        budget_limit=500000,
        currency="INR",
        merchant_whitelist=["merch_acme_electronics_01"],
        category_whitelist=["electronics"],
        expiry=int(time.time()) + 3600
    )

    print("[*] Mandate Generated for Python Client:")
    print(f"    - Mandate ID: {mandate.mandate_id}")
    print(f"    - Limit:      ₹{mandate.budget_limit / 100:.2f} INR")
    print(f"    - Public Key: {pub_hex[:16]}...")

if __name__ == "__main__":
    main()
