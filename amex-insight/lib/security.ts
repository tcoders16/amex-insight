import crypto from "crypto"

const SECRET = process.env.MCP_SHARED_SECRET ?? "dev-secret-change-in-prod"

/**
 * Sign a request body with HMAC-SHA256 + timestamp.
 * Prevents replay attacks (30s window enforced server-side).
 */
export function signRequest(body: string): Record<string, string> {
  const timestamp = Date.now().toString()
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(`${timestamp}.${body}`)
    .digest("hex")

  return {
    "Content-Type":  "application/json",
    "X-Timestamp":   timestamp,
    "X-Signature":   signature,
    "X-Client-Id":   "amex-insight-frontend",
  }
}

/** Scrub PII / secrets from any string before logging */
export function scrub(text: string): string {
  return text
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, "[CARD_REDACTED]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, "[TOKEN_REDACTED]")
    .replace(/sk-[A-Za-z0-9]{32,}/g, "[API_KEY_REDACTED]")
}
