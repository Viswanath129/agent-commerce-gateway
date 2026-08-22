import crypto from "node:crypto";
import type { BuyerMandate } from "./types.js";

/**
 * Normalizes the mandate object into a canonical deterministic string for signing/verification.
 */
export function getCanonicalMandateBytes(mandate: Omit<BuyerMandate, "signature">): Buffer {
  const canonicalObject = {
    mandate_id: mandate.mandate_id,
    principal_public_key: mandate.principal_public_key,
    budget_limit: mandate.budget_limit,
    currency: mandate.currency,
    merchant_whitelist: mandate.merchant_whitelist ? [...mandate.merchant_whitelist].sort() : undefined,
    category_whitelist: mandate.category_whitelist ? [...mandate.category_whitelist].sort() : undefined,
    expiry: mandate.expiry,
  };
  return Buffer.from(JSON.stringify(canonicalObject));
}

/**
 * Verifies an Ed25519 signature on a Buyer Mandate.
 */
export function verifyMandateSignature(mandate: BuyerMandate): boolean {
  try {
    const dataBytes = getCanonicalMandateBytes(mandate);
    const publicKeyBuffer = Buffer.from(mandate.principal_public_key, "hex");
    const signatureBuffer = Buffer.from(mandate.signature, "hex");

    // Ed25519 DER key wrapping or raw key verification
    const keyObject = crypto.createPublicKey({
      key: Buffer.concat([
        Buffer.from("302a300506032b6570032100", "hex"), // Ed25519 SPKI prefix
        publicKeyBuffer,
      ]),
      format: "der",
      type: "spki",
    });

    return crypto.verify(null, dataBytes, keyObject, signatureBuffer);
  } catch (error) {
    // If DER construction fails, fallback to standard Node crypto check or return false
    return false;
  }
}

/**
 * Generates an Ed25519 Keypair (for human client / demo runner).
 */
export function generatePrincipalKeypair(): {
  publicKeyHex: string;
  privateKeyHex: string;
  privateKeyObject: crypto.KeyObject;
  publicKeyObject: crypto.KeyObject;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  
  // Extract raw 32-byte public key
  const exportedSpki = publicKey.export({ type: "spki", format: "der" });
  const rawPublicKey = exportedSpki.subarray(exportedSpki.length - 32);

  // Extract raw 32-byte private key
  const exportedPkcs8 = privateKey.export({ type: "pkcs8", format: "der" });
  const rawPrivateKey = exportedPkcs8.subarray(exportedPkcs8.length - 32);

  return {
    publicKeyHex: rawPublicKey.toString("hex"),
    privateKeyHex: rawPrivateKey.toString("hex"),
    privateKeyObject: privateKey,
    publicKeyObject: publicKey,
  };
}

/**
 * Signs a mandate payload with an Ed25519 private key.
 */
export function signMandate(
  mandateData: Omit<BuyerMandate, "signature">,
  privateKeyObject: crypto.KeyObject
): string {
  const dataBytes = getCanonicalMandateBytes(mandateData);
  const signature = crypto.sign(null, dataBytes, privateKeyObject);
  return signature.toString("hex");
}
