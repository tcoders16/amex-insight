"""
list_index — returns the full document knowledge tree.

Shows every indexed document, its pages, and section names.
Useful for Claude to know what's available before searching.
"""
from __future__ import annotations

import time
import logging
from collections import defaultdict

from pydantic import BaseModel
from rag.indexer import get_index
from observability.tracer import trace_tool

logger = logging.getLogger(__name__)


class IndexTreeResponse(BaseModel):
    total_chunks: int
    documents: list[dict]   # [{doc_id, page_count, pages: [{page_num, section}]}]
    built_ms:  int


@trace_tool("list_index")
async def list_index(_: None = None) -> IndexTreeResponse:
    """
    Return the full document knowledge tree — every doc_id, page_num,
    and section currently indexed. Call this first to know what documents
    are available before calling search_financial_docs.
    """
    t0    = time.perf_counter()
    index = get_index()

    rows = index.db.execute(
        "SELECT doc_id, page_num, section FROM chunks_meta ORDER BY doc_id, page_num"
    ).fetchall()

    tree: dict[str, list[dict]] = defaultdict(list)
    for doc_id, page_num, section in rows:
        tree[doc_id].append({"page_num": page_num, "section": section})

    documents = [
        {"doc_id": doc_id, "page_count": len(pages), "pages": pages}
        for doc_id, pages in sorted(tree.items())
    ]

    return IndexTreeResponse(
        total_chunks = len(rows),
        documents    = documents,
        built_ms     = int((time.perf_counter() - t0) * 1000),
    )
