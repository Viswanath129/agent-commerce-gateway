# Vercel verification matrix

Status is deliberately blank until a real authenticated production deployment
exists. Do not replace these rows with inferred results.

| Check | Expected result | Recorded result |
| --- | --- | --- |
| `GET /` | `200`, SPA assets load | Not yet deployed |
| `GET /v1/health` | `200`, demo runtime health | Not yet deployed |
| `GET /dashboard/health` without bearer token | `401` | Not yet deployed |
| `GET /dashboard/health` with valid bearer token | `200` | Not yet deployed |
| `GET /catalog` | `200`, merchant truth data | Not yet deployed |
| `POST /v1/commerce/chat` | Real gateway response | Not yet deployed |
| `POST /v1/commerce/cross-sell/action` | Real gateway response | Not yet deployed |
| `GET /v1/analytics/revenue` | Real gateway response | Not yet deployed |
| checkout replay/budget/revocation/capability/confirmation | Denied or controlled per policy | Not yet deployed |
| forged, `mock_signature`, malformed, duplicate and invalid-state webhook | Rejected or safely deduplicated | Not yet deployed |
| FINDING-001 through FINDING-008 replay | All blocked | Not yet deployed |
| Browser dashboard | Operator token is runtime-only; each view uses actual API data | Not yet deployed |

For every completed row, record the exact URL, method, status, response
summary, security outcome, and any database/resource mutation result. Do not
send real financial intents to `VERCEL_DEMO=1` because its in-memory database
is non-durable.
