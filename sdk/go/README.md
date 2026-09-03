# Agent Commerce Gateway (ACG) — Go SDK

Official Go client library for merchant control plane integration and autonomous AI commerce on Razorpay.

## Features
- Native Ed25519 Key Generation & Mandate Signing (`crypto/ed25519`)
- Atomic Agent Checkout Execution
- Policy Mutation API
- Webhook HMAC Validation

## Quick Start
```go
package main

import (
	"fmt"
	"time"
	"github.com/viswanath129/agent-commerce-gateway/sdk/go/acg"
)

func main() {
	client := acg.NewClient("http://localhost:3000")
	kp, _ := acg.GenerateKeypair()
	mandate := acg.BuyerMandate{
		MandateID:          "man_buyer_go_01",
		PrincipalPublicKey: kp.PublicKeyHex,
		BudgetLimit:        500000,
		CategoryWhitelist:  []string{"electronics"},
		Expiry:             time.Now().Unix() + 3600,
	}

	order, err := client.Checkout(mandate, kp.PrivateKeyHex, []acg.ProposedItem{
		{SKU: "SKU-MOUSE-PRO", Quantity: 1},
	})
	if err != nil {
		panic(err)
	}
	fmt.Println("Order ID:", order.RazorpayOrderID)
}
```
