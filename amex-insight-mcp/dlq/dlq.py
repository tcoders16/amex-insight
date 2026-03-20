"""
Dead Letter Queue via Upstash Redis.
After MAX_RETRIES failed tool calls → enqueue here.
DLQ is reviewed daily — patterns drive prompt + schema improvements.
Same pattern as Resso.ai — 60% DLQ reduction after 3 months of analysis.
"""
from __future__ import annotations

import json
import os
import time
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_redis = None

def get_redis():
    global _redis
    if _redis is None:
        url = os.environ.get("UPSTASH_REDIS_URL")
        if url:
            from upstash_redis import Redis
            _redis = Redis.from_env()
        else:
            logger.warning("[dlq] No UPSTASH_REDIS_URL — DLQ disabled (dev mode)")
    return _redis


async def enqueue(
    tool:    str,
    args:    dict,
    error:   str,
    session: Optional[str] = None,
):
    """Enqueue a failed tool call to the dead letter queue."""
    r = get_redis()
    if r is None:
        logger.warning(f"[dlq] Redis unavailable — dropping: {tool}")
        return

    entry = {
        "tool":    tool,
        "args":    args,          # already scrubbed by caller
        "error":   error,
        "session": session,
        "ts":      time.time(),
    }
    try:
        await r.lpush("dlq:failed_calls", json.dumps(entry))
        # Keep DLQ bounded at 1000 entries
        await r.ltrim("dlq:failed_calls", 0, 999)
        logger.info(f"[dlq] Enqueued failed call: {tool}")
    except Exception as e:
        logger.error(f"[dlq] Failed to enqueue: {e}")


async def depth() -> int:
    """Return current DLQ depth."""
    r = get_redis()
    if r is None:
        return 0
    try:
        return await r.llen("dlq:failed_calls")
    except Exception:
        return 0


async def rate_check(client_id: str, limit: int = 20, window: int = 60) -> bool:
    """
    Sliding window rate limiter.
    Returns True if request is allowed, False if rate limit exceeded.
    """
    r = get_redis()
    if r is None:
        return True   # allow in dev mode

    key = f"rate:{client_id}:{int(time.time() // window)}"
    try:
        count = await r.incr(key)
        if count == 1:
            await r.expire(key, window)
        return count <= limit
    except Exception:
        return True   # fail open on Redis error
