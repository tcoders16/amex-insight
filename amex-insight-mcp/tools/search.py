from schemas.models import SearchRequest, SearchResponse
from rag.indexer import get_index
from rag.retriever import hybrid_search
from observability.tracer import trace_tool


@trace_tool("search_financial_docs")
async def search_financial_docs(req: SearchRequest) -> SearchResponse:
    """
    Hybrid BM25 + FTS5 retrieval with cross-encoder reranking.
    No vector DB. Returns page-level chunks with citations.
    """
    index = get_index()
    return await hybrid_search(
        query=req.query,
        index=index,
        top_k=req.top_k,
        year_filter=req.year_filter,
    )
