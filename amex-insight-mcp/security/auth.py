"""
HMAC-SHA256 request signing verification.
Prevents:
  - Unauthorized access (shared secret)
  - Request tampering (body integrity)
  - Replay attacks (30-second timestamp window)
"""
from __future__ import annotations

import hmac
import hashlib
import time
import os
import re
import logging

from fastapi import Request, HTTPException

logger = logging.getLogger(__name__)

SECRET = os.environ.get("MCP_SHARED_SECRET", "dev-secret-change-in-prod")
REPLAY_WINDOW_SECS = 30

# ─── PII scrubbing patterns ──────────────────────────────────────────────────

_SCRUB_PATTERNS = [
    (re.compile(r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b"), "[CARD_REDACTED]"),
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),                       "[SSN_REDACTED]"),
    (re.compile(r"Bearer\s+[A-Za-z0-9\-._~+/]+=*"),              "[TOKEN_REDACTED]"),
    (re.compile(r"sk-[A-Za-z0-9]{32,}"),                          "[API_KEY_REDACTED]"),
]


def scrub(text: str) -> str:
    """Remove PII and secrets from any string before logging."""
    for pattern, replacement in _SCRUB_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


# ─── HMAC verification ───────────────────────────────────────────────────────

async def verify_hmac(request: Request) -> bytes:
    """
    Verify HMAC-SHA256 signature on incoming request.
    Returns raw body if valid.
    Raises HTTP 401 on any failure.
    """
    body = await request.body()

    # In dev mode, skip verification
    if SECRET == "dev-secret-change-in-prod":
        logger.warning("[auth] Running in DEV mode — HMAC verification skipped")
        return body

    timestamp = request.headers.get("X-Timestamp", "")
    signature = request.headers.get("X-Signature", "")

    if not timestamp or not signature:
        logger.warning("[auth] Missing X-Timestamp or X-Signature headers")
        raise HTTPException(status_code=401, detail="Missing auth headers")

    # Replay protection
    try:
        ts = float(timestamp)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid timestamp")

    if abs(time.time() - ts) > REPLAY_WINDOW_SECS:
        logger.warning(f"[auth] Replay attack detected: timestamp age={abs(time.time()-ts):.1f}s")
        raise HTTPException(status_code=401, detail="Request expired")

    # HMAC verification
    message  = f"{timestamp}.{body.decode('utf-8', errors='replace')}"
    expected = hmac.new(
        SECRET.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        logger.warning("[auth] HMAC signature mismatch")
        raise HTTPException(status_code=401, detail="Invalid signature")

    return body
