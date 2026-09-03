package acg

import (
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	BaseURL    string
	APIToken   string
	HTTPClient *http.Client
}

func NewClient(baseURL string, apiToken ...string) *Client {
	token := ""
	if len(apiToken) > 0 {
		token = apiToken[0]
	}
	return &Client{
		BaseURL:    strings.TrimRight(baseURL, "/"),
		APIToken:   token,
		HTTPClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *Client) do(method, path string, body interface{}, target interface{}) error {
	var bodyReader io.Reader
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return err
		}
		bodyReader = bytes.NewBuffer(jsonData)
	}

	req, err := http.NewRequest(method, c.BaseURL+path, bodyReader)
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if c.APIToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.APIToken)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("acg api error [%d]: %s", resp.StatusCode, string(respBytes))
	}

	if target != nil && len(respBytes) > 0 {
		return json.Unmarshal(respBytes, target)
	}
	return nil
}

func (c *Client) GetHealth() (*HealthResponse, error) {
	var res HealthResponse
	err := c.do("GET", "/dashboard/health", nil, &res)
	return &res, err
}

func (c *Client) UpdatePolicy(policy MerchantPolicy) error {
	return c.do("PUT", "/v1/merchant/policy", policy, nil)
}

func (c *Client) Checkout(mandate BuyerMandate, privKeyHex string, items []ProposedItem) (*CheckoutResponse, error) {
	if mandate.Signature == "" {
		privBytes, err := hex.DecodeString(privKeyHex)
		if err != nil {
			return nil, err
		}
		sig, err := SignMandate(&mandate, privBytes)
		if err != nil {
			return nil, err
		}
		mandate.Signature = sig
	}

	nonceBytes := make([]byte, 16)
	rand.Read(nonceBytes)
	nonce := hex.EncodeToString(nonceBytes)

	intentIDBytes := make([]byte, 16)
	rand.Read(intentIDBytes)
	intentID := fmt.Sprintf("%x-%x-%x-%x-%x", intentIDBytes[0:4], intentIDBytes[4:6], intentIDBytes[6:8], intentIDBytes[8:10], intentIDBytes[10:16])

	intent := CanonicalIntent{
		IntentID:      intentID,
		ClientNonce:   nonce,
		Timestamp:     time.Now().Unix(),
		Mandate:       mandate,
		ProposedItems: items,
	}

	var res CheckoutResponse
	err := c.do("POST", "/v1/agent/checkout", intent, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) VerifyWebhookSignature(rawBody, signature, webhookSecret string) bool {
	mac := hmac.New(sha256.New, []byte(webhookSecret))
	mac.Write([]byte(rawBody))
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}
