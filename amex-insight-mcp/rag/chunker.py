"""
Document chunker — LangChain RecursiveCharacterTextSplitter.

This is how raw 10-K PDF text was split into chunks before indexing.
Run once offline to build the SQLite + BM25 index.

WHY CHUNK_OVERLAP MATTERS:
  Imagine a key fact spans two pages:
    "...total revenue was"   ← end of chunk N
    "$17.2 billion in 2024"  ← start of chunk N+1

  Without overlap: BM25 never matches "total revenue $17.2 billion" — it's split.
  With overlap=100: the 100 chars at the end of chunk N appear at the start of N+1.
  The cross-encoder can then score the overlapping chunk correctly.

WHY RecursiveCharacterTextSplitter (not CharacterTextSplitter):
  RecursiveCharacterTextSplitter tries separators in order:
    ["\n\n", "\n", ". ", " ", ""]
  It first tries to split on paragraph breaks (best). If a paragraph is still
  too large, it tries line breaks. Then sentence ends. Then words. Then chars.
  This preserves semantic coherence — a sentence is never split mid-word.

CHUNK_SIZE = 800:
  ~600 words per chunk.
  Small enough: cross-encoder inference stays fast (~50ms per pair).
  Large enough: enough context for the model to understand the fact.
  AMEX 10-Ks average 250 pages → ~2,500 chunks per filing → ~12,500 total.

HOW IT CONNECTS TO THE RETRIEVAL PIPELINE:
  Ingest:  raw_text → split_text() → Chunk objects → DocumentIndex.add_chunks()
               → SQLite FTS5 + BM25 index updated

  Query:   user_query → BM25 top-20 + FTS5 top-20 → merge → cross-encoder rerank
               → top-8 chunks with scores → cited in final response
"""
from __future__ import annotations

import logging
from typing import Optional
from pathlib import Path

logger = logging.getLogger(__name__)


def split_document(
    text:          str,
    doc_id:        str,
    page_num:      int = 1,
    section:       str = "",
    chunk_size:    int = 800,
    chunk_overlap: int = 100,
) -> list[dict]:
    """
    Split a raw document text into overlapping chunks using LangChain's
    RecursiveCharacterTextSplitter, then format for the DocumentIndex.

    Args:
        text:          Raw text of the document page/section.
        doc_id:        Document identifier (e.g. "2024-10k").
        page_num:      Page number for citation tracking.
        section:       Section heading (e.g. "Management Discussion").
        chunk_size:    Target characters per chunk (default 800 ≈ 600 words).
        chunk_overlap: Overlap between adjacent chunks (default 100 chars).

    Returns:
        List of chunk dicts ready for DocumentIndex.add_chunks().
    """
    try:
        from langchain_text_splitters import RecursiveCharacterTextSplitter
    except ImportError:
        logger.warning("[chunker] langchain-text-splitters not installed, using naive split")
        return _naive_split(text, doc_id, page_num, section, chunk_size)

    splitter = RecursiveCharacterTextSplitter(
        chunk_size    = chunk_size,
        chunk_overlap = chunk_overlap,
        # Try these separators in order — paragraph → line → sentence → word → char
        separators    = ["\n\n", "\n", ". ", " ", ""],
        length_function = len,
    )

    raw_chunks = splitter.split_text(text)

    chunks = []
    for i, chunk_text in enumerate(raw_chunks):
        chunk_id = f"{doc_id}_p{page_num}_c{i}"
        context  = f"{doc_id} · Page {page_num}"
        if section:
            context += f" · {section}"

        chunks.append({
            "id":       chunk_id,
            "doc_id":   doc_id,
            "page_num": page_num,
            "section":  section,
            "text":     chunk_text.strip(),
            "context":  context,
        })

    logger.info(
        f"[chunker] {doc_id} p{page_num} → {len(raw_chunks)} chunks "
        f"(size={chunk_size}, overlap={chunk_overlap})"
    )
    return chunks


def _naive_split(
    text: str, doc_id: str, page_num: int, section: str, chunk_size: int
) -> list[dict]:
    """Fallback splitter — no overlap, splits on paragraph breaks."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks = []
    for i, para in enumerate(paragraphs):
        chunks.append({
            "id":       f"{doc_id}_p{page_num}_c{i}",
            "doc_id":   doc_id,
            "page_num": page_num,
            "section":  section,
            "text":     para[:chunk_size],
            "context":  f"{doc_id} · Page {page_num}",
        })
    return chunks


def ingest_page_to_index(
    text:     str,
    doc_id:   str,
    page_num: int,
    section:  str = "",
) -> int:
    """
    Split a page and add it directly to the running DocumentIndex.
    Used by the /ingest endpoint and index_document_page MCP tool.

    Returns number of chunks added.
    """
    from rag.indexer import get_index
    from schemas.models import Chunk

    raw_chunks = split_document(text, doc_id, page_num, section)
    chunk_objs = [Chunk(**c) for c in raw_chunks]
    get_index().add_chunks(chunk_objs)
    return len(chunk_objs)
