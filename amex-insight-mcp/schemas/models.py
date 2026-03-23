"""
Pydantic schemas for all MCP tool I/O.
Every tool input and output is validated here.
Same pattern as Lawline + Resso — zero silent failures.
"""
from __future__ import annotations
from pydantic import BaseModel, Field, field_validator
# re-export so tools can import BaseModel from here
__all__ = ["BaseModel"]
from typing import Optional


# ─── Shared ──────────────────────────────────────────────────────────────────

class Citation(BaseModel):
    doc:     str
    page:    int = Field(ge=1)
    section: str = ""
    score:   float = Field(ge=0.0, le=1.0)


class Chunk(BaseModel):
    id:      str
    doc_id:  str
    page_num: int = Field(ge=1)
    section: str = ""
    text:    str
    context: str = ""    # contextual retrieval prefix
    score:   float = Field(default=0.0, ge=0.0, le=1.0)


# ─── search_financial_docs ───────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query:       str    = Field(min_length=1, max_length=500)
    top_k:       int    = Field(default=8, ge=1, le=20)
    year_filter: Optional[int] = Field(default=None, ge=2000, le=2030)

    @field_validator("query")
    @classmethod
    def sanitize_query(cls, v: str) -> str:
        # Strip potential prompt injection attempts
        return v.replace("<", "&lt;").replace(">", "&gt;").strip()


class SearchResponse(BaseModel):
    chunks:           list[Chunk]
    query:            str
    retrieval_method: str = "bm25+fts5+crossencoder"
    total_candidates: int
    reranked:         bool = True
    retrieval_ms:     int


# ─── get_document_page ───────────────────────────────────────────────────────

class PageRequest(BaseModel):
    doc_id:   str = Field(min_length=1, max_length=100)
    page_num: int = Field(ge=1)


class PageResponse(BaseModel):
    doc_id:   str
    page_num: int
    section:  str
    text:     str
    context:  str


# ─── compare_benchmarks ──────────────────────────────────────────────────────

class BenchmarkRequest(BaseModel):
    category: str = Field(min_length=1, max_length=100)
    quarter:  str = Field(min_length=1, max_length=20)


class BenchmarkResponse(BaseModel):
    category:        str
    quarter:         str
    avg_spend_usd:   float
    percentile_50:   float
    percentile_75:   float
    percentile_90:   float
    sample_size:     int
    source:          str


# ─── validate_faithfulness ───────────────────────────────────────────────────

class FaithfulnessRequest(BaseModel):
    answer:  str        = Field(min_length=1, max_length=5000)
    context: list[str]  = Field(min_length=1, max_length=20)


class FaithfulnessResponse(BaseModel):
    score:          float       = Field(ge=0.0, le=1.0)
    passed:         bool        # score >= 0.75
    flagged_claims: list[str]   = Field(default_factory=list)
    method:         str         = "cross-encoder-nli"


# ─── extract_kpis ────────────────────────────────────────────────────────────

class KpiRequest(BaseModel):
    doc_id: str = Field(min_length=1, max_length=100)


class KPIReport(BaseModel):
    doc_id:               str
    revenue_b_usd:        Optional[float] = None
    network_volumes_t_usd: Optional[float] = None
    yoy_growth_pct:       Optional[float] = None
    card_member_spend_b:  Optional[float] = None
    new_card_acquisitions_m: Optional[float] = None
    net_income_b_usd:     Optional[float] = None
    citations:            list[Citation] = Field(default_factory=list)
    extraction_method:    str = "regex+rag"


# ─── index_document_page ─────────────────────────────────────────────────────

class IndexRequest(BaseModel):
    doc_id:   str  = Field(min_length=1,  max_length=100)
    page_num: int  = Field(ge=1)
    section:  str  = Field(default="",   max_length=200)
    text:     str  = Field(min_length=10, max_length=10_000)
    context:  str  = Field(default="",   max_length=1_000,
                           description="Contextual retrieval prefix (optional)")

    @field_validator("doc_id")
    @classmethod
    def normalize_doc_id(cls, v: str) -> str:
        return v.strip().lower()


class IndexResponse(BaseModel):
    chunk_id:         str
    doc_id:           str
    page_num:         int
    token_count:      int          # whitespace tokens added to BM25
    fts5_indexed:     bool         # confirmed in SQLite FTS5
    bm25_corpus_size: int          # total chunks in BM25 after rebuild
    index_ms:         int          # wall-clock time for full index op
    pipeline:         list[str]    # steps executed, for architecture demo


# ─── save_chat ───────────────────────────────────────────────────────────────

class SaveChatRequest(BaseModel):
    title:    str        = Field(min_length=1, max_length=200)
    messages: list[dict] = Field(min_length=1)
    summary:  str        = Field(default="", max_length=500)
    tags:     list[str]  = Field(default_factory=list, max_length=10)


class SaveChatResponse(BaseModel):
    chat_id:       str
    title:         str
    message_count: int
    saved_at:      int


# ─── list_saved_chats ─────────────────────────────────────────────────────────

class ListSavedChatsRequest(BaseModel):
    limit:      int           = Field(default=50, ge=1, le=200)
    tag_filter: Optional[str] = None


class SavedChatMeta(BaseModel):
    chat_id:       str
    title:         str
    summary:       str = ""
    tags:          list[str]
    created_at:    int
    message_count: int


class ListSavedChatsResponse(BaseModel):
    chats: list[SavedChatMeta]
    total: int


# ─── get_saved_chat ───────────────────────────────────────────────────────────

class GetSavedChatRequest(BaseModel):
    chat_id: str = Field(min_length=1, max_length=100)


class GetSavedChatResponse(BaseModel):
    chat_id:    str
    title:      str
    summary:    str        = ""
    messages:   list[dict]
    tags:       list[str]
    created_at: int        = 0
    found:      bool


# ─── delete_saved_chat ────────────────────────────────────────────────────────

class DeleteSavedChatRequest(BaseModel):
    chat_id: str = Field(min_length=1, max_length=100)


class DeleteSavedChatResponse(BaseModel):
    chat_id: str
    deleted: bool


# ─── send_email_summary ──────────────────────────────────────────────────────

class EmailRequest(BaseModel):
    to:                  str        = Field(default="emailtosolankiom@gmail.com", min_length=5, max_length=200)
    from_name:           str        = Field(default="AmexInsight")              # display name in From header
    subject:             str        = Field(default="", max_length=300)
    query:               str        = Field(min_length=1, max_length=500)
    summary:             str        = Field(min_length=1, max_length=5000)
    confidence_score:    float      = Field(default=1.0, ge=0.0, le=1.0)
    citations:           list[dict] = Field(default_factory=list)
    attachment_b64:      str        = Field(default="")   # base64-encoded file bytes
    attachment_filename: str        = Field(default="")   # e.g. "Report.docx"


class EmailResponse(BaseModel):
    success:    bool
    message_id: str
    error:      str = ""


# ─── Health ──────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status:   str
    tools:    int
    dlq_depth: int
    uptime:   float
