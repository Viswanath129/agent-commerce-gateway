package acg

type BuyerMandate struct {
	MandateID          string   `json:"mandate_id"`
	PrincipalPublicKey string   `json:"principal_public_key"`
	BudgetLimit        int64    `json:"budget_limit"`
	Currency           string   `json:"currency"`
	MerchantWhitelist  []string `json:"merchant_whitelist,omitempty"`
	CategoryWhitelist  []string `json:"category_whitelist,omitempty"`
	Expiry             int64    `json:"expiry"`
	Signature          string   `json:"signature,omitempty"`
}

type ProposedItem struct {
	SKU      string `json:"sku"`
	Quantity int    `json:"quantity"`
}

type CanonicalIntent struct {
	IntentID      string         `json:"intent_id"`
	ClientNonce   string         `json:"client_nonce"`
	Timestamp     int64          `json:"timestamp"`
	Mandate       BuyerMandate   `json:"mandate"`
	ProposedItems []ProposedItem `json:"proposed_items"`
}

type MerchantPolicy struct {
	PolicyVersion                  string   `json:"policy_version"`
	EffectiveAt                    int64    `json:"effective_at"`
	MerchantID                     string   `json:"merchant_id"`
	MaxTransactionAmount           int64    `json:"max_transaction_amount"`
	AllowedCategories              []string `json:"allowed_categories"`
	AutoRefundOnFulfillmentFailure bool     `json:"auto_refund_on_fulfillment_failure"`
	MinMarginPercentage            int      `json:"min_margin_percentage"`
}

type CheckoutResponse struct {
	Status          string                   `json:"status"`
	IntentID        string                   `json:"intent_id"`
	Receipt         string                   `json:"receipt"`
	RazorpayOrderID string                   `json:"razorpay_order_id"`
	AmountPaise     int64                    `json:"amount_paise"`
	Currency        string                   `json:"currency"`
	PolicyVersion   string                   `json:"policy_version"`
	ReservationID   string                   `json:"reservation_id"`
	Items           []map[string]interface{} `json:"items,omitempty"`
}

type HealthResponse struct {
	Status     string                 `json:"status"`
	Components map[string]interface{} `json:"components"`
	Timestamp  int64                  `json:"timestamp"`
}
