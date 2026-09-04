# ACG Configuration & Environment Guide

## System Variables & Merchant Settings

---

## 1. Environment Variables

| Variable | Required | Default | Purpose |
| :--- | :---: | :--- | :--- |
| `PORT` | Optional | `3000` | HTTP server listening port |
| `HOST` | Optional | `0.0.0.0` | HTTP server binding host |
| `NODE_ENV` | Optional | `development` | Environment mode (`development`, `test`, `production`) |
| `RAZORPAY_KEY_ID` | Required | `rzp_test_placeholder_key` | Razorpay API Key ID |
| `RAZORPAY_KEY_SECRET` | Required | `rzp_test_placeholder_secret`| Razorpay API Secret |
| `RAZORPAY_WEBHOOK_SECRET` | Required | `rzp_webhook_secret_12345` | Razorpay Webhook HMAC Secret |
| `DATABASE_PATH` | Optional | `./data/acg_gateway.db` | Local SQLite database file path |
| `MERCHANT_ID` | Optional | `merch_acme_electronics_01` | Active merchant identifier |
