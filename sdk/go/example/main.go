package main

import (
	"fmt"
	"time"

	"github.com/viswanath129/agent-commerce-gateway/sdk/go/acg"
)

func main() {
	fmt.Println("=== ACG GO SDK DEMO ===")
	client := acg.NewClient("http://localhost:3000")

	kp, err := acg.GenerateKeypair()
	if err != nil {
		panic(err)
	}

	mandate := acg.BuyerMandate{
		MandateID:          fmt.Sprintf("man_go_%d", time.Now().Unix()),
		PrincipalPublicKey: kp.PublicKeyHex,
		BudgetLimit:        500000,
		Currency:           "INR",
		MerchantWhitelist:  []string{"merch_acme_electronics_01"},
		CategoryWhitelist:  []string{"electronics"},
		Expiry:             time.Now().Unix() + 3600,
	}

	fmt.Println("[*] Mandate Generated:")
	fmt.Printf("    - ID:     %s
", mandate.MandateID)
	fmt.Printf("    - Budget: ₹%.2f INR
", float64(mandate.BudgetLimit)/100.0)
	fmt.Printf("    - Key:    %s...
", kp.PublicKeyHex[:16])

	health, err := client.GetHealth()
	if err == nil {
		fmt.Printf("[+] Subsystem Status: %s
", health.Status)
	}
}
