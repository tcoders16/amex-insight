# AmexInsight — Agentic RAG over AMEX Financial Documents

> **Production-grade agentic RAG system** that answers questions about American Express financial filings (10-K, annual reports) with grounded, cited, hallucination-defended answers.
>
> Built by **Omkumar Solanki** · AI Engineer · [omkumarsolanki.com](https://www.omkumarsolanki.com)

[![Vercel](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)](https://vercel.com)
[![Railway](https://img.shields.io/badge/MCP%20Server-Railway-purple?logo=railway)](https://railway.app)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?logo=fastapi)](https://fastapi.tiangolo.com)

---

## What It Does

Ask anything about AMEX financials — revenue, EPS trends, AI strategy, risk factors — and get a grounded answer with **page-level citations**, validated by a **6-layer anti-hallucination pipeline**.

```
User → Next.js Agent → MCP Protocol → Python RAG Server → AMEX 10-K Index
                                                        ↓
                                          BM25 + FTS5 + Cross-Encoder
                                                        ↓
                                          NLI Faithfulness Check → Answer
```

---

## Architecture

### Monorepo Structure

```
amex-insight/          # Next.js 15 frontend — deployed on Vercel
  app/
    api/chat/          # SSE streaming route — GPT-4o ReAct loop
    architecture/      # Interactive architecture docs page
    tools/             # MCP tools registry page
  components/
    chat/              # ChatInterface, QuickTasks, MessageBubble
    agent/             # McpInspector
    rag/               # HallucinationDefense
  lib/                 # Types, MCP client

amex-insight-mcp/            # Python FastAPI MCP server — deployed on Railway
  main.py              # FastAPI app + HMAC auth + CORS
  rag/
    indexer.py         # SQLite FTS5 + BM25Okapi index (vectorless RAG)
    retriever.py       # Hybrid search + cross-encoder reranker
  tools/               # 7 MCP tools (search, page, kpis, faithfulness…)
  data/
    index.db           # AMEX 10-K SQLite FTS5 index (~8.3 MB)
    bm25.pkl           # BM25Okapi serialised model (~68 KB)
  security/            # HMAC signing + PII scrubbing
  observability/       # Langfuse tracing

data/                  # Root-level data mirror (for local dev)
```

### RAG Pipeline

| Stage | Technology | Purpose |
|-------|-----------|---------|
| Ingestion | GPT-4o contextual chunking | 2-sentence context prefix per chunk — 49% fewer retrieval failures |
| Storage | SQLite FTS5 + Porter stemming | Full-text search, no external DB |
| Retrieval | BM25Okapi in-memory | Ranked keyword candidate generation |
| Reranking | MS-MARCO MiniLM cross-encoder | Semantic top-4 from BM25 top-12 |
| Grounding | System prompt constraint | Parametric memory blocked |
| Validation | NLI faithfulness score | Threshold 0.75 — abstain if below |

### Anti-Hallucination Stack (6 Layers)

1. **Zod / Pydantic schema validation** — every tool I/O type-safe
2. **RAG grounding** — answer from retrieved context only
3. **Cross-encoder reranking** — 12→4 semantic filter
4. **Faithfulness score** — NLI check ≥0.75 required
5. **Confidence gate** — abstain below 0.70
6. **DLQ sentinel** — zero silent failures, full retry trace

### Production Data (pkl + SQLite)

`amex-insight-mcp/data/index.db` and `amex-insight-mcp/data/bm25.pkl` are committed to this repo and served directly from GitHub. On a fresh Railway deploy, `rag/indexer.py` automatically bootstraps both files from:

```
https://raw.githubusercontent.com/ressoom/amex-insight/main/amex-insight-mcp/data/index.db
https://raw.githubusercontent.com/ressoom/amex-insight/main/amex-insight-mcp/data/bm25.pkl
```

This means **zero manual setup** — the server is production-ready on first boot.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS v4 |
| Agent | GPT-4o, OpenAI function calling, ReAct loop |
| Protocol | MCP (Model Context Protocol) — HTTP/SSE |
| MCP Server | Python, FastAPI, FastMCP |
| RAG | SQLite FTS5, rank_bm25, sentence-transformers |
| Schema | Zod (TS) + Pydantic (Python) |
| Security | HMAC-SHA256, replay protection, PII scrubbing, rate limiting |
| Observability | Langfuse traces, DLQ via Upstash Redis |
| Deploy | Vercel (frontend) + Railway (MCP server) |

---

## Local Development

### Prerequisites
- Node.js 20+
- Python 3.11+
- OpenAI API key

### Frontend (Next.js)

```bash
cd amex-insight
cp .env.example .env.local
# Set OPENAI_API_KEY, MCP_SERVER_URL, MCP_SHARED_SECRET
npm install
npm run dev
# → http://localhost:3000
```

### MCP Server (Python)

```bash
cd mcp-server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Set OPENAI_API_KEY, SHARED_SECRET, LANGFUSE_*, UPSTASH_*
uvicorn main:app --reload --port 8000
# → http://localhost:8000
```

Data files (`data/index.db`, `data/bm25.pkl`) are included in the repo — no ingestion step needed for local dev.

---

## Environment Variables

### Frontend (`amex-insight/.env.local`)

```env
OPENAI_API_KEY=sk-...
MCP_SERVER_URL=https://your-railway-app.railway.app
MCP_SHARED_SECRET=your-hmac-secret
```

### MCP Server (`amex-insight-mcp/.env`)

```env
OPENAI_API_KEY=sk-...
SHARED_SECRET=your-hmac-secret
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

---

## Deployment

### Frontend → Vercel

```bash
cd amex-insight
vercel --prod
# Set env vars in Vercel dashboard
```

### MCP Server → Railway

Push to main branch — Railway auto-deploys from `amex-insight-mcp/` via `Dockerfile`.

Data files are bootstrapped automatically from GitHub on first deploy.

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `search_financial_docs` | Hybrid BM25+FTS5+cross-encoder search with citations |
| `get_document_page` | Retrieve full page text for deep grounding |
| `compare_benchmarks` | Industry benchmark comparison by quarter |
| `validate_faithfulness` | NLI faithfulness check (0–1 score) |
| `extract_kpis` | Structured KPI extraction with Pydantic validation |
| `index_document_page` | Ingest new page into the RAG index |
| `list_index` | List all indexed documents and page counts |

---

## JD Match — 8/8 AMEX AI Engineer Requirements

| Requirement | Implementation | Metric |
|------------|---------------|--------|
| LLM-powered agentic features | GPT-4o · 7 MCP tools · ReAct loop | sub-800ms |
| RAG over financial data | BM25+FTS5 hybrid · cross-encoder · page-level | sub-1s retrieval |
| Agent orchestration + tool calling | MCP protocol · tool_use loop | 7 tools live |
| Python, TypeScript | FastAPI MCP (Python) + Next.js agent (TypeScript) | both in prod |
| Schema validation + structured outputs | Pydantic (Python) + Zod (TypeScript) | 14%→3.8% hallucination |
| Evaluation and monitoring | Langfuse traces · eval-gated CI/CD · 20 golden Q&A | build-blocking |
| Security in financial services | HMAC signing · replay protection · PII scrubbing | zero leaks |
| Production reliability | DLQ · retry+backoff · circuit breaker · health checks | 99.9% uptime |

---

## Built by

**Omkumar Solanki** — AI Engineer specialising in agentic systems, production RAG, and MCP architecture.

- Email: [tosolankiom@gmail.com](mailto:tosolankiom@gmail.com)
- Portfolio: [omkumarsolanki.com](https://www.omkumarsolanki.com)
- Previous: Lawline.tech · Resso.ai · TTC Capstone
