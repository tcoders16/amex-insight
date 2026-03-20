from schemas.models import PageRequest, PageResponse
from rag.indexer import get_index
from observability.tracer import trace_tool
import logging

logger = logging.getLogger(__name__)


@trace_tool("get_document_page")
async def get_document_page(req: PageRequest) -> PageResponse:
    """Retrieve full text of a specific document page for deeper grounding."""
    index = get_index()
    row   = index.get_page(req.doc_id, req.page_num)

    if not row:
        logger.warning(f"[page] Not found: {req.doc_id} p{req.page_num}")
        return PageResponse(
            doc_id   = req.doc_id,
            page_num = req.page_num,
            section  = "unknown",
            text     = f"Page {req.page_num} not found in {req.doc_id}.",
            context  = "",
        )

    return PageResponse(
        doc_id   = row["doc_id"],
        page_num = row["page_num"],
        section  = row["section"],
        text     = row["text"],
        context  = row["context"],
    )
