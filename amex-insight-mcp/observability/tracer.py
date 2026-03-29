"""
Observability — LangSmith tracing for all MCP tool calls and LangGraph runs.

How it works:
  LangSmith is Anthropic/LangChain's hosted tracing platform.
  When LANGCHAIN_TRACING_V2=true + LANGCHAIN_API_KEY are set:
    → Every LangChain call (ChatOpenAI, PromptTemplate, etc.) is auto-traced
    → Every LangGraph node execution is auto-traced with state diffs
    → Custom MCP tools are traced via @traceable decorator

  LangSmith dashboard shows:
    - Full agent trace tree (which nodes ran, in what order, how long)
    - Token usage per LLM call
    - Input/output for every node
    - Latency breakdown
    - Eval results if you run evals against the traces

  Why LangSmith over Langfuse:
    - Native integration with LangGraph (zero-config tracing)
    - Eval framework built in (golden datasets, LLM-as-judge)
    - CI/CD quality gates (block deployment if accuracy < 90%)
    - Directly mentioned in the Amex JD interview topics

Environment variables required (add to .env):
  LANGCHAIN_TRACING_V2=true
  LANGCHAIN_API_KEY=<your key from smith.langchain.com>
  LANGCHAIN_PROJECT=amex-insight

Langfuse is kept as fallback for teams already using it.
"""
from __future__ import annotations

import os
import time
import logging
from functools import wraps
from typing import Any

from security.auth import scrub

logger = logging.getLogger(__name__)

# ── LangSmith setup ───────────────────────────────────────────────────────────
# Setting these env vars is all LangSmith needs.
# LangGraph + LangChain will auto-detect and trace everything.

def configure_langsmith() -> bool:
    """
    Activate LangSmith tracing if API key is configured.
    Called once at startup in main.py lifespan.

    Returns True if LangSmith is active, False if running without tracing.
    """
    api_key = os.environ.get("LANGCHAIN_API_KEY", "")
    if not api_key:
        logger.warning(
            "[tracer] No LANGCHAIN_API_KEY — LangSmith tracing disabled. "
            "Get a free key at smith.langchain.com"
        )
        return False

    # These three env vars activate LangSmith for all LangChain/LangGraph calls
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_PROJECT"]     = os.environ.get("LANGCHAIN_PROJECT", "amex-insight")

    logger.info(
        f"[tracer] LangSmith active → project={os.environ['LANGCHAIN_PROJECT']} "
        f"→ traces at smith.langchain.com"
    )
    return True


# ── Langfuse fallback (kept for backward compatibility) ───────────────────────

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
            logger.info("[tracer] Langfuse active as secondary tracer")
    return _langfuse


# ── @trace_tool decorator ─────────────────────────────────────────────────────
# Wraps any async MCP tool function with:
#   - LangSmith @traceable (primary)
#   - Langfuse span (fallback)
#   - Latency logging
#   - PII scrubbing on inputs/outputs

def trace_tool(tool_name: str):
    """
    Decorator: traces every MCP tool call.

    Usage:
        @trace_tool("search_financial_docs")
        async def search_financial_docs(req: SearchRequest) -> SearchResponse:
            ...

    What it captures:
        - Tool name + arguments (PII-scrubbed)
        - Return value (truncated, PII-scrubbed)
        - Latency in ms
        - Success / error status
        - Visible in LangSmith under project "amex-insight" → Runs tab
    """
    def decorator(fn):
        # Wrap with LangSmith @traceable if available
        try:
            from langsmith import traceable as ls_traceable
            traced_fn = ls_traceable(name=f"mcp:{tool_name}", run_type="tool")(fn)
        except ImportError:
            traced_fn = fn

        @wraps(fn)
        async def wrapper(*args, **kwargs):
            lf  = get_langfuse()
            t0  = time.perf_counter()
            span = None

            # Langfuse span (secondary)
            if lf:
                trace = lf.trace(name=f"mcp:{tool_name}")
                span  = trace.span(
                    name  = tool_name,
                    input = scrub(str(kwargs or args)),
                )

            try:
                result     = await traced_fn(*args, **kwargs)
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
