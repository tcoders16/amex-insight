"""
AmexInsight — FastMCP stdio server
───────────────────────────────────
Exposes all 5 AMEX RAG tools over MCP stdio protocol for Claude Desktop.

Models are lazy-loaded on first tool call (not at startup) so Claude Desktop
connects instantly without timing out during cross-encoder model warmup.
"""
from __future__ import annotations

import os
import sys
import logging
from pathlib import Path

# ── Silence all noisy output so stdio JSON-RPC stays clean ───────────────────
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("TRANSFORMERS_VERBOSITY",  "error")
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
os.environ.setdefault("SENTENCE_TRANSFORMERS_HOME",
    str(Path(__file__).parent / ".cache" / "st"))

logging.basicConfig(
    level   = logging.ERROR,
    stream  = sys.stderr,
    format  = "%(levelname)s %(name)s: %(message)s",
)
# Kill any remaining noise from libraries
for noisy in ("sentence_transformers", "transformers", "huggingface_hub",
              "torch", "httpx", "urllib3", "asyncio"):
    logging.getLogger(noisy).setLevel(logging.ERROR)

# ── Project path ──────────────────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))

from fastmcp import FastMCP
from schemas.models import (
    SearchRequest, PageRequest, BenchmarkRequest,
    FaithfulnessRequest, KpiRequest, IndexRequest,
)

# ── MCP server (tools register below, models lazy-load on first call) ─────────
mcp = FastMCP(
    name         = "AmexInsight",
    instructions = (
        "You have access to American Express public financial documents "
        "(10-K annual reports 2020–2024, 49 indexed chunks).\n"
        "Rules:\n"
        "1. ALWAYS call search_financial_docs before answering any financial question.\n"
        "2. ALWAYS cite doc_id and page_num in every answer.\n"
        "3. ALWAYS call validate_faithfulness before stating any numeric figure.\n"
        "4. If data is not retrieved, say so — never fabricate financial figures.\n"
        "Available docs: 2020-10k, 2021-10k, 2022-10k, 2023-10k, 2024-10k, multi-year"
    ),
)


# ── Tool 1: search_financial_docs ─────────────────────────────────────────────

@mcp.tool()
async def search_financial_docs(
    query: str,
    top_k: int = 8,
    year_filter: int | None = None,
) -> dict:
    """
    Search AMEX public financial documents using hybrid BM25 + FTS5 retrieval
    with MS-MARCO cross-encoder reranking. Returns grounded page-level chunks.

    Covers 10-K annual reports 2020–2024:
      Revenue, EPS, technology investment, AI strategy, fraud metrics,
      credit quality, capital return, billed business, risk factors,
      card member spending, generative AI, cobrand partnerships.

    Args:
        query:       Natural language search query
        top_k:       Number of chunks to return (default 8)
        year_filter: Restrict to one year's document (e.g. 2024)
    """
    from tools.search import search_financial_docs as _fn
    result = await _fn(SearchRequest(query=query, top_k=top_k, year_filter=year_filter))
    return result.model_dump()


# ── Tool 2: get_document_page ─────────────────────────────────────────────────

@mcp.tool()
async def get_document_page(doc_id: str, page_num: int) -> dict:
    """
    Retrieve full text of a specific page from an AMEX annual report for
    deeper grounding after an initial search.

    Available doc_ids:
      2020-10k · 2021-10k · 2022-10k · 2023-10k · 2024-10k · multi-year

    Args:
        doc_id:   Document identifier (e.g. "2024-10k")
        page_num: Page number to retrieve
    """
    from tools.page import get_document_page as _fn
    result = await _fn(PageRequest(doc_id=doc_id, page_num=page_num))
    return result.model_dump()


# ── Tool 3: compare_benchmarks ────────────────────────────────────────────────

@mcp.tool()
async def compare_benchmarks(category: str, quarter: str) -> dict:
    """
    Retrieve industry spend benchmark data (avg, P50, P75, P90) for a given
    expense category and quarter.

    Available categories: travel, restaurant, technology
    Available quarters:   "Q3 2024", "Q2 2024"

    Args:
        category: Expense category
        quarter:  Quarter string (e.g. "Q3 2024")
    """
    from tools.benchmarks import compare_benchmarks as _fn
    result = await _fn(BenchmarkRequest(category=category, quarter=quarter))
    return result.model_dump()


# ── Tool 4: validate_faithfulness ─────────────────────────────────────────────

@mcp.tool()
async def validate_faithfulness(answer: str, context: list[str]) -> dict:
    """
    Validate whether a draft answer is supported by retrieved context.
    Uses cross-encoder NLI. Returns score 0–1 and PASS/FAIL.

    Score >= 0.75 = PASS (grounded in evidence).
    Score <  0.75 = FAIL (potential hallucination — do not present to user).

    Call this before stating any financial figure.

    Args:
        answer:  Draft answer or claim to validate
        context: Retrieved text chunks that should support the answer
    """
    from tools.faithfulness import validate_faithfulness as _fn
    result = await _fn(FaithfulnessRequest(answer=answer, context=context))
    return result.model_dump()


# ── Tool 5: extract_kpis ─────────────────────────────────────────────────────

@mcp.tool()
async def extract_kpis(doc_id: str) -> dict:
    """
    Extract structured financial KPIs from an AMEX annual report.
    Returns Pydantic-validated fields: revenue_b_usd, net_income_b_usd,
    network_volumes_t_usd, yoy_growth_pct, with page citations.

    Args:
        doc_id: Document to extract from (e.g. "2024-10k", "2022-10k")
    """
    from tools.extract import extract_kpis as _fn
    result = await _fn(KpiRequest(doc_id=doc_id))
    return result.model_dump()


# ── Tool 6: index_document_page ───────────────────────────────────────────────

@mcp.tool()
async def index_document_page(
    doc_id:   str,
    page_num: int,
    text:     str,
    section:  str = "",
    context:  str = "",
) -> dict:
    """
    Index a new document page into the vectorless RAG pipeline.

    Demonstrates the full ingestion architecture:
      1. Pydantic validation
      2. Chunk ID generation  → {doc_id}_p{page_num}
      3. Tokenisation         → whitespace split, lowercased
      4. SQLite FTS5 upsert   → Porter stemming, full-text search
      5. BM25Okapi rebuild    → in-memory ranked keyword index
      6. Metadata upsert      → chunks_meta table
      7. FTS5 read-back verify → confirm chunk is retrievable

    No embeddings. No vector DB. Exact retrieval (BM25 + FTS5),
    semantic ranking via cross-encoder at query time.

    Returns pipeline trace: each step + timing, token count,
    corpus size after indexing, and FTS5 verification result.

    Args:
        doc_id:   Document identifier (e.g. "2025-10k", "q1-earnings")
        page_num: Page number (>=1)
        text:     Full page text to index (10–10000 chars)
        section:  Section heading (optional, improves retrieval)
        context:  Contextual retrieval prefix (optional)
    """
    from tools.index_page import index_document_page as _fn
    result = await _fn(IndexRequest(
        doc_id=doc_id, page_num=page_num,
        text=text, section=section, context=context,
    ))
    return result.model_dump()


# ── Tool 7: list_index ────────────────────────────────────────────────────────

@mcp.tool()
async def list_index() -> dict:
    """
    Return the full document knowledge tree — every doc_id, page number,
    and section name currently indexed in the vectorless RAG store.

    Call this FIRST before any search to know exactly what documents
    are available. Returns a tree:
      document → pages → sections

    Available docs: 2020-10k, 2021-10k, 2022-10k, 2023-10k, 2024-10k, multi-year
    """
    from tools.list_index import list_index as _fn
    result = await _fn()
    return result.model_dump()


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    mcp.run(transport="stdio", show_banner=False)
