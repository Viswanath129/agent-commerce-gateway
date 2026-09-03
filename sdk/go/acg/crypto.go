package acg

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
)

type Keypair struct {
	PublicKeyHex  string
	PrivateKeyHex string
	PublicKey     ed25519.PublicKey
	PrivateKey    ed25519.PrivateKey
}

func GenerateKeypair() (*Keypair, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	return &Keypair{
		PublicKeyHex:  hex.EncodeToString(pub),
		PrivateKeyHex: hex.EncodeToString(priv),
		PublicKey:     pub,
		PrivateKey:    priv,
	}, nil
}

func SignMandate(mandate *BuyerMandate, privKey ed25519.PrivateKey) (string, error) {
	clone := *mandate
	clone.Signature = ""
	
	bytes, err := json.Marshal(clone)
	if err != nil {
		return "", err
	}

	sig := ed25519.Sign(privKey, bytes)
	return hex.EncodeToString(sig), nil
}

func VerifyMandate(mandate *BuyerMandate) bool {
	if mandate.Signature == "" || mandate.PrincipalPublicKey == "" {
		return false
	}

	pubBytes, err := hex.DecodeString(mandate.PrincipalPublicKey)
	if err != nil || len(pubBytes) != ed25519.PublicKeySize {
		return false
	}

	sigBytes, err := hex.DecodeString(mandate.Signature)
	if err != nil || len(sigBytes) != ed25519.SignatureSize {
		return false
	}

	clone := *mandate
	clone.Signature = ""
	bytes, err := json.Marshal(clone)
	if err != nil {
		return false
	}

	return ed25519.Verify(ed25519.PublicKey(pubBytes), bytes, sigBytes)
}
