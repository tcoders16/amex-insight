"""
AmexInsight MCP Server
─────────────────────
FastAPI + FastMCP · Python · Railway

5 tools exposed via MCP protocol:
  • search_financial_docs   — hybrid BM25 + FTS5 + cross-encoder
  • get_document_page       — page-level grounding
  • compare_benchmarks      — spend benchmark comparison
  • validate_faithfulness   — NLI faithfulness check (layer 4)
  • extract_kpis            — structured KPI extraction

Security: HMAC-SHA256 · replay protection · rate limiting · PII scrubbing
Observability: Langfuse traces · DLQ via Upstash Redis
"""
from __future__ import annotations

import os
import time
import logging
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from pydantic_settings import BaseSettings

from schemas.models import (
    SearchRequest, PageRequest, BenchmarkRequest,
    FaithfulnessRequest, KpiRequest, IndexRequest, HealthResponse
)
from tools.search      import search_financial_docs
from tools.page        import get_document_page
from tools.benchmarks  import compare_benchmarks
from tools.faithfulness import validate_faithfulness
from tools.extract     import extract_kpis
from tools.index_page  import index_document_page
from tools.list_index  import list_index
from security.auth     import verify_hmac, scrub
from dlq.dlq           import enqueue, depth, rate_check
from rag.indexer       import get_index

# ─── Config ──────────────────────────────────────────────────────────────────

class Settings(BaseSettings):
    mcp_shared_secret:    str = "dev-secret-change-in-prod"
    upstash_redis_url:    str = ""
    upstash_redis_token:  str = ""
    langfuse_secret_key:  str = ""
    langfuse_public_key:  str = ""
    langfuse_host:        str = "https://cloud.langfuse.com"
    allowed_origins:      str = "https://amex-insight.vercel.app,http://localhost:3000"

    model_config = {"env_file": ".env", "extra": "ignore"}

settings = Settings()

logging.basicConfig(
    level  = logging.INFO,
    format = "%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ─── App startup ─────────────────────────────────────────────────────────────

START_TIME = time.time()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("[startup] Warming up index and reranker...")
    get_index()                        # loads SQLite + BM25
    from rag.retriever import get_reranker
    get_reranker()                     # loads cross-encoder
    logger.info("[startup] Ready")
    yield
    logger.info("[shutdown] Goodbye")

app = FastAPI(
    title       = "AmexInsight MCP Server",
    description = "Agentic RAG MCP server for AMEX financial document intelligence",
    version     = "1.0.0",
    lifespan    = lifespan,
    docs_url    = "/docs",
)

# ─── Middleware ───────────────────────────────────────────────────────────────

ALLOWED_ORIGINS = [o.strip() for o in settings.allowed_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins  = ALLOWED_ORIGINS,
    allow_methods  = ["GET", "POST"],
    allow_headers  = ["Content-Type", "X-Signature", "X-Timestamp", "X-Client-Id"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts = ["*"],   # restrict to your Railway domain in prod
)

# ─── MCP Tool dispatcher ─────────────────────────────────────────────────────

TOOL_REGISTRY = {
    "search_financial_docs":  (SearchRequest,      search_financial_docs),
    "get_document_page":      (PageRequest,         get_document_page),
    "compare_benchmarks":     (BenchmarkRequest,    compare_benchmarks),
    "validate_faithfulness":  (FaithfulnessRequest, validate_faithfulness),
    "extract_kpis":           (KpiRequest,          extract_kpis),
    "index_document_page":    (IndexRequest,        index_document_page),
    "list_index":             (None,                list_index),
}

MAX_RETRIES = 3
RETRY_BASE  = 0.1   # seconds

# ─── Routes ──────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status    = "ok",
        tools     = len(TOOL_REGISTRY),
        dlq_depth = await depth(),
        uptime    = round(time.time() - START_TIME, 1),
    )


@app.get("/mcp/tools")
async def list_tools(request: Request):
    """List all registered MCP tools with their schemas."""
    await verify_hmac(request)
    return [
        {
            "name":        name,
            "description": fn.__doc__,
            "inputSchema": schema.model_json_schema(),
        }
        for name, (schema, fn) in TOOL_REGISTRY.items()
    ]


@app.post("/mcp/call")
async def call_tool(request: Request):
    """
    MCP tool call endpoint.
    Validates HMAC, rate-limits, dispatches to tool, retries on failure,
    DLQ after max retries. Pydantic-validated on every I/O.
    """
    body = await verify_hmac(request)

    # Rate limiting
    client_id = request.headers.get("X-Client-Id", "anonymous")
    if not await rate_check(client_id):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    # Parse dispatch request
    try:
        payload = json.loads(body)
        tool_name  = payload.get("tool") or payload.get("name", "")
        tool_args  = payload.get("arguments") or payload.get("args") or {}
    except (json.JSONDecodeError, KeyError):
        raise HTTPException(status_code=400, detail="Invalid MCP call payload")

    if tool_name not in TOOL_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Unknown tool: {tool_name}")

    Schema, handler = TOOL_REGISTRY[tool_name]

    # Pydantic validation
    try:
        req = Schema(**tool_args)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Schema validation failed: {scrub(str(e))}")

    # Execute with retry + backoff + jitter
    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            result = await handler(req)
            return JSONResponse(content=result.model_dump())
        except Exception as e:
            last_error = e
            logger.warning(f"[{tool_name}] attempt {attempt}/{MAX_RETRIES} failed: {scrub(str(e))}")
            if attempt < MAX_RETRIES:
                import asyncio, random
                delay = RETRY_BASE * (2 ** attempt) + random.uniform(0, 0.05)
                await asyncio.sleep(delay)

    # All retries exhausted → DLQ
    await enqueue(
        tool    = tool_name,
        args    = {k: scrub(str(v)) for k, v in tool_args.items()},
        error   = scrub(str(last_error)),
        session = client_id,
    )
    raise HTTPException(
        status_code = 503,
        detail      = f"Tool {tool_name} failed after {MAX_RETRIES} attempts. Enqueued to DLQ.",
    )


@app.post("/mcp/dlq")
async def receive_dlq(request: Request):
    """Receive DLQ entries from the frontend (for client-side failures)."""
    await verify_hmac(request)
    body = await request.body()
    try:
        entry = json.loads(body)
        await enqueue(
            tool    = entry.get("tool", "unknown"),
            args    = entry.get("args", {}),
            error   = entry.get("error", "client-side failure"),
            session = "frontend",
        )
    except Exception:
        pass
    return {"status": "received"}


# ─── Ingest endpoint ──────────────────────────────────────────────────────────

@app.post("/ingest")
async def ingest_document(request: Request):
    """
    Ingest a document into the index.
    Expects: { doc_id, chunks: [{ page_num, section, text, context }] }
    """
    await verify_hmac(request)
    body = json.loads(await request.body())

    from schemas.models import Chunk
    chunks = [
        Chunk(
            id       = f"{body['doc_id']}_p{c['page_num']}",
            doc_id   = body["doc_id"],
            page_num = c["page_num"],
            section  = c.get("section", ""),
            text     = c["text"],
            context  = c.get("context", ""),
        )
        for c in body["chunks"]
    ]

    get_index().add_chunks(chunks)
    return {"status": "indexed", "doc_id": body["doc_id"], "chunks": len(chunks)}


# ─── Dev server ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
