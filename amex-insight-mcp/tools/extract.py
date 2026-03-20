"""
Structured KPI extraction from financial documents.
Regex + RAG hybrid — extracts financial figures with citations.
Returns Pydantic-validated KPIReport.
"""
from __future__ import annotations

import re
import logging
from schemas.models import KpiRequest, KPIReport, Citation
from rag.indexer import get_index
from rag.retriever import hybrid_search
from observability.tracer import trace_tool

logger = logging.getLogger(__name__)

# Financial figure patterns
_PATTERNS = {
    "revenue_b_usd":          re.compile(r"(?:total\s+)?(?:net\s+)?revenues?\s+(?:of\s+)?\$?([\d.]+)\s*billion", re.I),
    "network_volumes_t_usd":  re.compile(r"(?:billed\s+business|network\s+volumes?)\s+(?:of\s+)?\$?([\d.]+)\s*trillion", re.I),
    "yoy_growth_pct":         re.compile(r"(?:increased|grew|growth\s+of)\s+([\d.]+)%\s+(?:year.over.year|YoY|vs\.?\s+prior)", re.I),
    "net_income_b_usd":       re.compile(r"net\s+income\s+(?:of\s+)?\$?([\d.]+)\s*billion", re.I),
}


@trace_tool("extract_kpis")
async def extract_kpis(req: KpiRequest) -> KPIReport:
    """
    Extract structured KPIs by searching the document and applying regex patterns.
    Returns Pydantic-validated schema.
    """
    index   = get_index()
    results = await hybrid_search(
        query=f"revenue net income financial results KPIs {req.doc_id}",
        index=index,
        top_k=10,
    )

    kpis: dict = {}
    citations:  list[Citation] = []

    for chunk in results.chunks:
        combined_text = f"{chunk.context} {chunk.text}"
        for field, pattern in _PATTERNS.items():
            if field in kpis:
                continue
            m = pattern.search(combined_text)
            if m:
                try:
                    kpis[field] = float(m.group(1))
                    citations.append(Citation(
                        doc     = chunk.doc_id,
                        page    = chunk.page_num,
                        section = chunk.section,
                        score   = chunk.score,
                    ))
                except (ValueError, IndexError):
                    pass

    logger.info(f"[extract_kpis] doc={req.doc_id} extracted={list(kpis.keys())}")

    return KPIReport(
        doc_id               = req.doc_id,
        citations            = citations,
        extraction_method    = "regex+rag",
        **kpis
    )
