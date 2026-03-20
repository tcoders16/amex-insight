"""
Langfuse tracing for all MCP tool calls.
Every call gets a trace: input (scrubbed), output, latency, retries.
Build-blocking eval pipeline uses these traces as ground truth.
"""
from __future__ import annotations

import os
import time
import logging
from typing import Optional, Any
from functools import wraps

from security.auth import scrub

logger = logging.getLogger(__name__)

_langfuse = None

def get_langfuse():
    global _langfuse
    if _langfuse is None:
        sk = os.environ.get("LANGFUSE_SECRET_KEY")
        pk = os.environ.get("LANGFUSE_PUBLIC_KEY")
        if sk and pk:
            from langfuse import Langfuse
            _langfuse = Langfuse(
                secret_key = sk,
                public_key = pk,
                host       = os.environ.get("LANGFUSE_HOST", "https://cloud.langfuse.com"),
            )
        else:
            logger.warning("[tracer] No Langfuse keys — tracing disabled (dev mode)")
    return _langfuse


def trace_tool(tool_name: str):
    """Decorator: traces every MCP tool call with Langfuse."""
    def decorator(fn):
        @wraps(fn)
        async def wrapper(*args, **kwargs):
            lf = get_langfuse()
            t0 = time.perf_counter()
            span = None

            if lf:
                trace = lf.trace(name=f"mcp:{tool_name}")
                span  = trace.span(
                    name  = tool_name,
                    input = scrub(str(kwargs or args)),
                )

            try:
                result = await fn(*args, **kwargs)
                latency_ms = int((time.perf_counter() - t0) * 1000)
                if span:
                    span.end(
                        output   = scrub(str(result))[:500],
                        metadata = {"latency_ms": latency_ms, "status": "success"},
                    )
                logger.info(f"[{tool_name}] ok — {latency_ms}ms")
                return result
            except Exception as e:
                latency_ms = int((time.perf_counter() - t0) * 1000)
                if span:
                    span.end(
                        output   = scrub(str(e))[:500],
                        metadata = {"latency_ms": latency_ms, "status": "error"},
                        level    = "ERROR",
                    )
                logger.error(f"[{tool_name}] error — {e}")
                raise

        return wrapper
    return decorator
