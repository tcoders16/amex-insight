"""
Hybrid retriever: BM25 + FTS5 → merge → cross-encoder rerank.
No vector DB. Cross-encoder IS the semantic layer.
"""
from __future__ import annotations

import time
import logging
from typing import Optional

from sentence_transformers import CrossEncoder
from schemas.models import Chunk, SearchResponse
from rag.indexer import DocumentIndex

logger = logging.getLogger(__name__)

# Load once at startup — CPU inference, ~100ms cold start
_reranker: Optional[CrossEncoder] = None

def get_reranker() -> CrossEncoder:
    global _reranker
    if _reranker is None:
        logger.info("[reranker] Loading MS-MARCO cross-encoder...")
        _reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
        logger.info("[reranker] Loaded")
    return _reranker


async def hybrid_search(
    query: str,
    index: DocumentIndex,
    top_k: int = 8,
    year_filter: Optional[int] = None,
) -> SearchResponse:
    """
    1. BM25 candidate retrieval (top-20)
    2. SQLite FTS5 candidate retrieval (top-20)
    3. Merge + dedupe (up to 30 candidates)
    4. Cross-encoder rerank → top_k
    5. Return with metadata
    """
    t0 = time.perf_counter()

    # ── Retrieve candidates ──────────────────────────────────────────────────
    bm25_ids = index.bm25_search(query, limit=20)
    fts_ids  = index.fts_search(query,  limit=20)

    # Merge preserving BM25 priority, deduplicate
    seen: set[str] = set()
    candidate_ids: list[str] = []
    for cid in bm25_ids + fts_ids:
        if cid not in seen:
            seen.add(cid)
            candidate_ids.append(cid)
        if len(candidate_ids) >= 30:
            break

    if not candidate_ids:
        return SearchResponse(
            chunks=[], query=query,
            total_candidates=0, reranked=False,
            retrieval_ms=int((time.perf_counter() - t0) * 1000)
        )

    candidates = index.get_chunks_by_ids(candidate_ids)

    # ── Year filter ──────────────────────────────────────────────────────────
    if year_filter:
        candidates = [
            c for c in candidates
            if str(year_filter) in c["doc_id"]
        ]

    if not candidates:
        return SearchResponse(
            chunks=[], query=query,
            total_candidates=0, reranked=False,
            retrieval_ms=int((time.perf_counter() - t0) * 1000)
        )

    # ── Cross-encoder rerank ──────────────────────────────────────────────────
    reranker = get_reranker()
    pairs    = [
        (query, f"{c['context']}\n{c['text']}")
        for c in candidates
    ]
    scores = reranker.predict(pairs)

    ranked = sorted(
        zip(candidates, scores),
        key=lambda x: x[1],
        reverse=True
    )[:top_k]

    chunks = [
        Chunk(
            id       = c["id"],
            doc_id   = c["doc_id"],
            page_num = c["page_num"],
            section  = c["section"],
            text     = c["text"],
            context  = c["context"],
            score    = float(min(max(score, 0.0), 1.0)),
        )
        for c, score in ranked
    ]

    retrieval_ms = int((time.perf_counter() - t0) * 1000)
    logger.info(
        f"[retriever] query={query[:50]!r} "
        f"candidates={len(candidates)} reranked={len(chunks)} ms={retrieval_ms}"
    )

    return SearchResponse(
        chunks=chunks,
        query=query,
        total_candidates=len(candidates),
        reranked=True,
        retrieval_ms=retrieval_ms,
    )
