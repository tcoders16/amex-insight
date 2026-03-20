"""
Vectorless page indexer — MCP tool that demonstrates the full ingestion pipeline.

Architecture:
  1. Pydantic validation          — sanitise & validate input
  2. Chunk ID generation          — deterministic: {doc_id}_p{page_num}
  3. Tokenisation                 — whitespace split, lowercased
  4. SQLite FTS5 upsert           — Porter-stemmed full-text index
  5. BM25Okapi corpus rebuild     — in-memory ranked keyword index
  6. Metadata store upsert        — chunks_meta for raw retrieval
  7. Verification read-back       — confirm FTS5 can find the chunk

Returns detailed pipeline trace so Claude (or the UI) can narrate
exactly what happened at each stage.
"""
from __future__ import annotations

import time
import logging

from schemas.models import IndexRequest, IndexResponse, Chunk
from rag.indexer import get_index
from observability.tracer import trace_tool

logger = logging.getLogger(__name__)


@trace_tool("index_document_page")
async def index_document_page(req: IndexRequest) -> IndexResponse:
    """
    Ingest a document page into the vectorless RAG index.

    Pipeline:
      Pydantic validate → tokenise → SQLite FTS5 upsert (Porter stemming)
      → BM25Okapi corpus rebuild → metadata upsert → FTS5 read-back verify

    No embeddings. No vector DB. The cross-encoder at query time IS
    the semantic layer — retrieval is exact (BM25 + FTS5), ranking is semantic.
    """
    t0       = time.perf_counter()
    pipeline = []

    # ── Step 1: Build chunk ID ─────────────────────────────────────────────────
    chunk_id = f"{req.doc_id}_p{req.page_num}"
    pipeline.append(f"chunk_id={chunk_id!r}")

    # ── Step 2: Tokenise (mirrors BM25 pipeline) ──────────────────────────────
    tokens      = req.text.lower().split()
    token_count = len(tokens)
    pipeline.append(f"tokenise: {token_count} tokens")

    # ── Step 3: Build context prefix if not provided ──────────────────────────
    context = req.context or (
        f"From {req.doc_id} annual report, page {req.page_num}"
        + (f", {req.section}." if req.section else ".")
    )
    pipeline.append("context_prefix: ready")

    # ── Step 4 + 5 + 6: Index via DocumentIndex (FTS5 + BM25 + meta) ──────────
    index = get_index()
    chunk = Chunk(
        id       = chunk_id,
        doc_id   = req.doc_id,
        page_num = req.page_num,
        section  = req.section,
        text     = req.text,
        context  = context,
    )

    index.add_chunks([chunk])
    pipeline.append("fts5_upsert: ok (Porter stemming)")
    pipeline.append("bm25_rebuild: ok")
    pipeline.append("meta_upsert: ok")

    # ── Step 7: Verify — FTS5 read-back ──────────────────────────────────────
    probe_token   = tokens[0] if tokens else req.doc_id
    fts5_hits     = index.fts_search(probe_token, limit=5)
    fts5_verified = chunk_id in fts5_hits
    pipeline.append(f"fts5_verify: {'PASS' if fts5_verified else 'WARN — not in top-5'}")

    corpus_size = index.total_chunks()
    pipeline.append(f"corpus_size: {corpus_size} chunks")

    index_ms = int((time.perf_counter() - t0) * 1000)
    pipeline.append(f"total_ms: {index_ms}ms")

    logger.info(
        f"[index_page] indexed {chunk_id!r} "
        f"tokens={token_count} fts5={fts5_verified} corpus={corpus_size} ms={index_ms}"
    )

    return IndexResponse(
        chunk_id         = chunk_id,
        doc_id           = req.doc_id,
        page_num         = req.page_num,
        token_count      = token_count,
        fts5_indexed     = fts5_verified,
        bm25_corpus_size = corpus_size,
        index_ms         = index_ms,
        pipeline         = pipeline,
    )
