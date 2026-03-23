"use client"

import { useEffect, useState } from "react"
import { Server, Zap, CheckCircle, Clock, AlertCircle, RefreshCw,
         Mail, FileText, Search, Database, Shield, Brain, List,
         GitBranch, Cpu } from "lucide-react"
import { clsx } from "clsx"

interface ToolDef {
  name:         string
  description:  string
  inputSchema:  Record<string, unknown>
  returnSchema: Record<string, unknown>
  techDepth:    string[]
  category:     "retrieval" | "validation" | "output" | "index"
  callsToday:   number
  avgLatencyMs: number
  dlqCount:     number
}

interface McpStatus {
  status:   string
  tools:    number
  dlqDepth: number
  uptime:   number
}

const CATEGORY_META = {
  retrieval:  { label: "Retrieval",   color: "blue",   icon: <Search className="w-3.5 h-3.5" /> },
  validation: { label: "Validation",  color: "green",  icon: <Shield className="w-3.5 h-3.5" /> },
  output:     { label: "Output",      color: "purple", icon: <FileText className="w-3.5 h-3.5" /> },
  index:      { label: "Index",       color: "gold",   icon: <Database className="w-3.5 h-3.5" /> },
}

const COLOR_MAP = {
  blue:   { text: "text-accent-blue",   bg: "bg-accent-blue/8",   border: "border-accent-blue/15"  },
  green:  { text: "text-emerald-500",   bg: "bg-emerald-50",      border: "border-emerald-200"      },
  purple: { text: "text-violet-500",    bg: "bg-violet-50",       border: "border-violet-200"       },
  gold:   { text: "text-amber-500",     bg: "bg-amber-50",        border: "border-amber-200"        },
  red:    { text: "text-red-500",       bg: "bg-red-50",          border: "border-red-200"          },
}

const MOCK_TOOLS: ToolDef[] = [
  {
    name:        "search_financial_docs",
    description: "Hybrid BM25 + SQLite FTS5 retrieval with MS-MARCO cross-encoder reranking over AMEX 10-K filings 2020–2024. Returns grounded page-level chunks with doc_id, page_num, section, score, and exact text.",
    category:    "retrieval",
    inputSchema: {
      query:       "string — natural language question (sanitised, HTML-escaped)",
      top_k:       "number — candidates to return (default 8, max 20)",
      year_filter: "number | null — restrict to one fiscal year (e.g. 2024)",
    },
    returnSchema: {
      chunks:           "Chunk[] — [{id, doc_id, page_num, section, text, context, score}]",
      query:            "string — echoed sanitised query",
      retrieval_method: "string — 'bm25+fts5+crossencoder'",
      total_candidates: "number — BM25 pool before reranking",
      reranked:         "boolean",
      retrieval_ms:     "number — wall-clock retrieval time",
    },
    techDepth: [
      "BM25Okapi (rank_bm25) — in-memory probabilistic keyword scoring. TF-IDF normalised by document length. Full corpus rebuild on every index_document_page call.",
      "SQLite FTS5 — Porter stemmer. 'investing' matches 'invest' matches 'investment'. Boolean, phrase, and prefix queries. Zero external DB — single file on disk.",
      "MS-MARCO cross-encoder (cross-encoder/ms-marco-MiniLM-L-6-v2) — fine-tuned on 500K real search queries. Scores every (query, chunk) pair. This is the semantic layer — not embedding lookup but inference.",
      "Contextual retrieval prefix — 2-sentence context prepended at index time: 'From AMEX 2024 10-K, MD&A section: ...' improves recall ~49% (Anthropic benchmark).",
      "Pydantic SearchRequest — query sanitised (HTML-escaped), top_k clamped 1–20, year_filter validated 2000–2030. Silent bad input impossible.",
    ],
    callsToday:   847,
    avgLatencyMs: 182,
    dlqCount:     0,
  },
  {
    name:        "get_document_page",
    description: "Retrieve the full verbatim text of a specific page from a financial document. Used for deeper grounding after an initial search — lets the agent read the full page context around a cited passage.",
    category:    "retrieval",
    inputSchema: {
      doc_id:   "string — '2024-10k' | '2023-10k' | '2022-10k' | '2021-10k' | '2020-10k' | 'multi-year'",
      page_num: "number — exact page number (>= 1)",
    },
    returnSchema: {
      doc_id:   "string",
      page_num: "number",
      section:  "string — section heading at that page",
      text:     "string — full page text",
      context:  "string — contextual retrieval prefix",
    },
    techDepth: [
      "Direct SQLite lookup by composite key (doc_id, page_num) — O(1) retrieval from chunks_meta table.",
      "Returns the same chunk structure used by search_financial_docs so the agent can verify full page context when a search result is ambiguous.",
      "Pydantic PageRequest — doc_id max 100 chars, page_num >= 1. Zero silent failures.",
    ],
    callsToday:   234,
    avgLatencyMs: 48,
    dlqCount:     0,
  },
  {
    name:        "compare_benchmarks",
    description: "Retrieve industry spend benchmark data (avg, P50, P75, P90) for a given expense category and quarter. Allows AMEX card spend figures to be contextualised against industry averages.",
    category:    "retrieval",
    inputSchema: {
      category: "string — 'travel' | 'restaurant' | 'technology'",
      quarter:  "string — 'Q3 2024' | 'Q2 2024'",
    },
    returnSchema: {
      category:      "string",
      quarter:       "string",
      avg_spend_usd: "float",
      percentile_50: "float",
      percentile_75: "float",
      percentile_90: "float",
      sample_size:   "int",
      source:        "string",
    },
    techDepth: [
      "Pydantic-validated BenchmarkRequest — category and quarter clamped to known values.",
      "Returns structured percentile data (P50/P75/P90) alongside average — enabling distribution analysis not just point estimates.",
      "Designed for direct integration with generate_document and send_email_summary to produce benchmarked analyst reports.",
    ],
    callsToday:   156,
    avgLatencyMs: 94,
    dlqCount:     0,
  },
  {
    name:        "validate_faithfulness",
    description: "NLI cross-encoder faithfulness gate. Validates whether a draft answer is supported by retrieved context. Score >= 0.75 = PASS. Below threshold = FAIL — agent must not present the answer. This is the hallucination kill switch.",
    category:    "validation",
    inputSchema: {
      answer:  "string — draft answer or financial claim to validate (max 5000 chars)",
      context: "string[] — retrieved text chunks that should support the answer (max 20 items)",
    },
    returnSchema: {
      score:          "float 0.0–1.0 — NLI entailment score",
      passed:         "boolean — score >= 0.75",
      flagged_claims: "string[] — specific claims that failed entailment",
      method:         "string — 'cross-encoder-nli'",
    },
    techDepth: [
      "MS-MARCO cross-encoder NLI model — runs inference on every (answer, context_chunk) pair. Not keyword matching — semantic entailment checking.",
      "Threshold 0.75 is deliberate: financial figures require high confidence. A 74% score means the model isn't sure the evidence supports the claim.",
      "flagged_claims returns the specific sentences that failed — the agent can identify exactly which number isn't grounded and remove it.",
      "Called by the agent before synthesising any final answer. The system prompt enforces this: validate_faithfulness is mandatory before stating any numeric figure.",
      "Pydantic FaithfulnessRequest — answer clamped to 5000 chars, context list max 20 items. Prevents token limit abuse.",
    ],
    callsToday:   612,
    avgLatencyMs: 94,
    dlqCount:     2,
  },
  {
    name:        "extract_kpis",
    description: "Structured KPI extraction from AMEX annual reports. Returns Pydantic-validated financial metrics — revenue, net income, network volumes, YoY growth, card acquisitions — with page-level citations for every figure.",
    category:    "retrieval",
    inputSchema: {
      doc_id: "string — '2024-10k' | '2023-10k' | '2022-10k' | '2021-10k' | '2020-10k'",
    },
    returnSchema: {
      doc_id:                  "string",
      revenue_b_usd:           "float | null — total revenues in billions USD",
      network_volumes_t_usd:   "float | null — billed business in trillions USD",
      yoy_growth_pct:          "float | null — year-over-year revenue growth %",
      card_member_spend_b:     "float | null — card member spending billions USD",
      new_card_acquisitions_m: "float | null — new card acquisitions millions",
      net_income_b_usd:        "float | null — net income billions USD",
      citations:               "Citation[] — [{doc, page, section, score}] for every KPI",
      extraction_method:       "string — 'regex+rag'",
    },
    techDepth: [
      "Regex pattern extraction over retrieved chunks — targets specific financial statement formats found in SEC 10-K filings.",
      "Combined with RAG retrieval to locate the correct financial statement section before applying patterns — prevents false positive matches.",
      "Every extracted figure is tagged with its source citation (page number + section). Null means the figure was not found in the indexed text — the system never fabricates a value.",
      "Pydantic KPIReport validates all floats and enforces Citation schema on every source reference.",
    ],
    callsToday:   89,
    avgLatencyMs: 340,
    dlqCount:     0,
  },
  {
    name:        "index_document_page",
    description: "Full ingestion pipeline for new document pages. Runs 7 sequential steps: Pydantic validation → chunk ID generation → tokenisation → SQLite FTS5 upsert → BM25Okapi rebuild → metadata upsert → FTS5 read-back verify. Returns a full pipeline trace with per-step timing.",
    category:    "index",
    inputSchema: {
      doc_id:   "string — document identifier (normalised to lowercase)",
      page_num: "number — page number (>= 1)",
      text:     "string — full page text (10–10000 chars)",
      section:  "string — section heading (optional, improves retrieval)",
      context:  "string — contextual retrieval prefix (optional, max 1000 chars)",
    },
    returnSchema: {
      chunk_id:         "string — '{doc_id}_p{page_num}'",
      doc_id:           "string",
      page_num:         "number",
      token_count:      "number — whitespace tokens in BM25 corpus",
      fts5_indexed:     "boolean — confirmed retrievable via FTS5 probe",
      bm25_corpus_size: "number — total chunks after rebuild",
      index_ms:         "number — wall-clock time for full pipeline",
      pipeline:         "string[] — each step with timing",
    },
    techDepth: [
      "Step 1 — Pydantic IndexRequest: doc_id normalised to lowercase, text length 10–10000 enforced, context max 1000 chars.",
      "Step 2 — Chunk ID: deterministic '{doc_id}_p{page_num}' — collision-safe, human-readable, enables upsert semantics.",
      "Step 3 — Tokenisation: whitespace split + lowercase — exactly mirrors BM25Okapi corpus format so term frequencies are consistent.",
      "Step 4 — SQLite FTS5 upsert: INSERT OR REPLACE into fts_chunks. Porter stemmer activated. 'revenues' = 'revenue' = 'revenu'. No schema migration needed — FTS5 is schemaless.",
      "Step 5 — BM25Okapi rebuild: full in-memory corpus rebuilt from all chunks_meta rows. O(N) but fast for <10K chunks. Necessary because BM25 IDF depends on the whole corpus.",
      "Step 6 — Metadata upsert: chunks_meta table stores raw text + context prefix. This is the input to the cross-encoder at query time.",
      "Step 7 — FTS5 read-back verify: probe query confirms the chunk is immediately retrievable. Catches FTS5 synchronisation issues before returning success.",
    ],
    callsToday:   12,
    avgLatencyMs: 38,
    dlqCount:     0,
  },
  {
    name:        "list_index",
    description: "Return the full document knowledge tree — every doc_id, page number, and section currently indexed. Returns a hierarchical tree: document → pages → sections. Call this first to see exactly what the system knows.",
    category:    "index",
    inputSchema: {},
    returnSchema: {
      tree: "Record<doc_id, {pages: number[], sections: Record<page, string>}>",
      total_chunks: "number",
      total_docs:   "number",
    },
    techDepth: [
      "Direct SQLite SELECT over chunks_meta — returns aggregate of all indexed content in one query.",
      "Used by the agent at the start of a session to understand exactly what documents are available before calling search_financial_docs.",
      "Returns deterministic output — no model involved. Pure database read. Sub-10ms.",
    ],
    callsToday:   45,
    avgLatencyMs: 8,
    dlqCount:     0,
  },
  {
    name:        "generate_document",
    description: "Generate a professional Word (.docx) or PowerPoint (.pptx) from financial analysis content. Builds the file server-side, saves to /tmp/generated/, base64-encodes the bytes for email attachment, and returns a download URL.",
    category:    "output",
    inputSchema: {
      doc_type:  "string — 'word' | 'ppt'",
      title:     "string — document title (max 200 chars)",
      subtitle:  "string — subtitle or date (optional)",
      sections:  "Section[] — [{heading: string, body: string}]",
    },
    returnSchema: {
      success:     "boolean",
      filename:    "string — '{safe_title}_{uid}.docx/pptx'",
      url:         "string — download URL via /files/{filename}",
      content_b64: "string — base64-encoded file bytes for email attachment",
      error:       "string — Python exception type + message if failed",
    },
    techDepth: [
      "python-docx for Word: custom AMEX-branded heading (RGBColor 0x006FCE), section headings, footer with source attribution and timestamp.",
      "python-pptx for PowerPoint: title slide, one content slide per section with bullet points (max 8 per slide), attribution slide.",
      "UUID hex suffix in filename prevents collisions across concurrent requests.",
      "content_b64 — file read back immediately after generation, base64-encoded for MIME attachment. The email delivery never needs the URL to work — the bytes are carried inline.",
      "OUTPUT_DIR = /tmp/generated (GENERATED_DIR env override) — /tmp is writable everywhere. Azure /home/generated was removed after write-permission failures.",
      "Error response includes type(e).__name__: e so ModuleNotFoundError, PermissionError, etc. surfaces directly in the agent trace panel.",
    ],
    callsToday:   67,
    avgLatencyMs: 420,
    dlqCount:     0,
  },
  {
    name:        "send_email_summary",
    description: "Send a financial insight email via Gmail SMTP (STARTTLS port 587) with optional Word/PPT file attachment. All layout uses table-based CSS for Gmail compatibility. Subject, from_name, to, body, and attachment are all dynamic.",
    category:    "output",
    inputSchema: {
      query:               "string — original financial question shown in email header",
      summary:             "string — full grounded answer (markdown rendered to HTML)",
      to:                  "string — recipient email (default: emailtosolankiom@gmail.com)",
      from_name:           "string — sender display name (default: AmexInsight)",
      subject:             "string — email subject (auto-generated from query if blank)",
      confidence_score:    "float — faithfulness score 0–1 shown as badge + progress bar",
      attachment_b64:      "string — base64 file bytes from generate_document (optional)",
      attachment_filename: "string — e.g. 'AMEX_Analysis.docx' (optional)",
    },
    returnSchema: {
      success:    "boolean",
      message_id: "string — 'gmail-smtp' on success",
      error:      "string — SMTP error message if failed",
    },
    techDepth: [
      "MIMEMultipart('mixed') — outer envelope. MIMEMultipart('alternative') — HTML body. MIMEBase('application', 'octet-stream') — file attachment with encode_base64.",
      "Gmail-safe HTML: all layout uses <table role='presentation'> with <td> cells. Gmail strips display:flex causing text concatenation — table layout is the only reliable option.",
      "Confidence badge: score >= 0.75 = green (High), >= 0.50 = amber (Medium), < 0.50 = red (Low). Color applied to dot, label, and faithfulness meter bar.",
      "Subject auto-generated as '{from_name}: {query[:60]}' when not provided — always meaningful, never blank.",
      "Attachment attachment: base64 bytes decoded server-side, attached as MIMEBase. File never touches the user's browser — built server-side, sent directly via SMTP.",
      "GMAIL_USER + GMAIL_APP_PASS loaded from .env via explicit Path(__file__).parent / '.env' — handles any working directory, including Azure App Service and Claude Desktop stdio.",
      "to, from_name, subject, attachment all fully dynamic — any recipient, any sender name, any subject, any file.",
    ],
    callsToday:   203,
    avgLatencyMs: 1900,
    dlqCount:     0,
  },
]

const PIPELINE_STEPS = [
  { n: "01", label: "User sends a message",               detail: "Captured by Next.js Route Handler. RequestSchema (Zod) validates messages array before any processing." },
  { n: "02", label: "GPT-4o agent plans the query",       detail: "ReAct loop starts. Agent reads system prompt rules, decides which tools to call and in what order." },
  { n: "03", label: "search_financial_docs called",       detail: "BM25+FTS5 retrieves 8–12 candidate chunks. MS-MARCO cross-encoder reranks to top-4 by semantic relevance." },
  { n: "04", label: "validate_faithfulness called",       detail: "NLI model checks: does the draft answer exist in the retrieved context? Score < 0.75 = FAIL, agent retries." },
  { n: "05", label: "generate_document (if requested)",   detail: "python-docx or python-pptx builds file server-side. content_b64 captured as pendingAttachment." },
  { n: "06", label: "send_email_summary (if requested)",  detail: "pendingAttachment injected automatically. MIME email with file built and sent via Gmail SMTP STARTTLS." },
  { n: "07", label: "SSE done event streams to browser",  detail: "citations[], generatedDocs[], sessionMemory[], faithfulness score all sent in the done event payload." },
  { n: "08", label: "UI renders citations + download",    detail: "CitationCard shows doc_id · page · section · score. DocDownloadButton renders per generated file." },
]

export default function ToolsPage() {
  const [status, setStatus]     = useState<McpStatus | null>(null)
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"tools" | "pipeline" | "desktop">("tools")

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/health")
      const data = await res.json()
      setStatus(data.mcp)
    } catch {
      setStatus({ status: "unreachable", tools: 0, dlqDepth: 0, uptime: 0 })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStatus() }, [])

  const online    = status?.status !== "unreachable"
  const byCategory = (cat: ToolDef["category"]) => MOCK_TOOLS.filter(t => t.category === cat)

  return (
    <div className="min-h-screen bg-surface pt-14">
      <div className="fixed inset-0 bg-grid-subtle opacity-30 pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-6 py-16">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full
                          border border-border bg-surface-2 mb-4">
            <span className="text-[10px] font-mono text-ink-faint uppercase tracking-widest">
              MCP Server · 9 Registered Tools · FastAPI + FastMCP
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-heading font-bold text-3xl mb-2">
                <span className="gradient-blue">MCP Tools</span>
              </h1>
              <p className="text-ink-muted text-sm max-w-xl leading-relaxed">
                Python FastAPI MCP server on Azure App Service. 9 tools across retrieval,
                validation, indexing, and output. Every tool Pydantic-validated, HMAC-secured,
                and Langfuse-traced. Connected via HTTP to Next.js and via stdio to Claude Desktop.
              </p>
            </div>
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border
                         bg-surface-2 hover:bg-surface-3 transition-colors text-sm text-ink-muted
                         disabled:opacity-40 flex-shrink-0"
            >
              <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Server status ──────────────────────────────────────────── */}
        <div className={clsx(
          "flex items-center justify-between p-4 rounded-xl border mb-6",
          online ? "bg-accent-green/5 border-accent-green/15" : "bg-accent-red/5 border-accent-red/15"
        )}>
          <div className="flex items-center gap-3">
            <Server className={clsx("w-5 h-5", online ? "text-accent-green" : "text-accent-red")} />
            <div>
              <div className="font-heading font-semibold text-sm text-ink">amex-insight-mcp</div>
              <div className="text-[11px] font-mono text-ink-faint">
                Python 3.11 · FastAPI · FastMCP · Azure App Service (Canada Central)
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {[
              { label: "Status",  value: status?.status ?? "—",                          color: online ? "green" : "red" },
              { label: "Tools",   value: String(status?.tools ?? MOCK_TOOLS.length)                                      },
              { label: "DLQ",     value: String(status?.dlqDepth ?? 0),                  color: (status?.dlqDepth ?? 0) > 0 ? "red" : "green" },
              { label: "Uptime",  value: status?.uptime ? `${Math.round(status.uptime / 3600)}h` : "—" },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className={clsx(
                  "text-sm font-mono font-bold",
                  s.color === "green" ? "text-accent-green" :
                  s.color === "red"   ? "text-accent-red"   : "text-ink-muted"
                )}>{s.value}</div>
                <div className="text-[10px] font-mono text-ink-faint">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 rounded-xl border border-border bg-surface-2 mb-8">
          {([
            { id: "tools",    label: "9 Tools",             icon: <Zap className="w-3.5 h-3.5" /> },
            { id: "pipeline", label: "Full Request Pipeline", icon: <GitBranch className="w-3.5 h-3.5" /> },
            { id: "desktop",  label: "Claude Desktop MCP",   icon: <Cpu className="w-3.5 h-3.5" /> },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={clsx(
                "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg",
                "text-xs font-mono transition-all",
                activeTab === t.id
                  ? "bg-surface-1 border border-border text-ink shadow-sm"
                  : "text-ink-faint hover:text-ink-muted"
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Tools ─────────────────────────────────────────────── */}
        {activeTab === "tools" && (
          <div className="space-y-8">
            {(["retrieval", "validation", "output", "index"] as const).map(cat => {
              const tools = byCategory(cat)
              if (!tools.length) return null
              const meta  = CATEGORY_META[cat]
              const col   = COLOR_MAP[meta.color as keyof typeof COLOR_MAP]
              return (
                <div key={cat}>
                  <div className={clsx(
                    "inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-3",
                    col.bg, col.border, col.text
                  )}>
                    {meta.icon}
                    <span className="text-[11px] font-mono uppercase tracking-wider">{meta.label}</span>
                    <span className="text-[10px] font-mono opacity-60">· {tools.length} tool{tools.length > 1 ? "s" : ""}</span>
                  </div>

                  <div className="space-y-2">
                    {tools.map(tool => {
                      const isOpen = expanded === tool.name
                      return (
                        <div key={tool.name}
                             className="rounded-xl border border-border bg-surface-1 overflow-hidden">
                          <button
                            onClick={() => setExpanded(isOpen ? null : tool.name)}
                            className="w-full flex items-start justify-between p-4
                                       hover:bg-surface-2 transition-colors text-left"
                          >
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className={clsx(
                                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 border",
                                col.bg, col.border, col.text
                              )}>
                                {meta.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-mono font-semibold text-sm text-ink mb-1">
                                  {tool.name}
                                </div>
                                <p className="text-xs text-ink-muted leading-relaxed line-clamp-2">
                                  {tool.description}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                              <div className="text-right hidden sm:block">
                                <div className="text-xs font-mono text-ink-muted">{tool.callsToday.toLocaleString()}</div>
                                <div className="text-[10px] font-mono text-ink-faint">calls today</div>
                              </div>
                              <div className="text-right hidden sm:block">
                                <div className="flex items-center gap-1 text-xs font-mono text-ink-muted">
                                  <Clock className="w-3 h-3 text-ink-faint" />
                                  {tool.avgLatencyMs}ms
                                </div>
                                <div className="text-[10px] font-mono text-ink-faint">avg latency</div>
                              </div>
                              <div className="text-right">
                                {tool.dlqCount === 0 ? (
                                  <CheckCircle className="w-4 h-4 text-accent-green" />
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <AlertCircle className="w-4 h-4 text-accent-red" />
                                    <span className="text-xs font-mono text-accent-red">{tool.dlqCount}</span>
                                  </div>
                                )}
                                <div className="text-[10px] font-mono text-ink-faint text-right">DLQ</div>
                              </div>
                            </div>
                          </button>

                          {isOpen && (
                            <div className="border-t border-border">
                              <div className="p-4 space-y-4">

                                {/* Schemas */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <div className="text-[10px] font-mono text-ink-faint uppercase mb-2">Input Schema</div>
                                    <pre className="text-[11px] font-mono text-ink-muted bg-surface-2 rounded-lg p-3
                                                    border border-border overflow-x-auto leading-relaxed">
                                      {JSON.stringify(tool.inputSchema, null, 2)}
                                    </pre>
                                  </div>
                                  <div>
                                    <div className="text-[10px] font-mono text-ink-faint uppercase mb-2">Return Schema</div>
                                    <pre className="text-[11px] font-mono text-ink-muted bg-surface-2 rounded-lg p-3
                                                    border border-border overflow-x-auto leading-relaxed">
                                      {JSON.stringify(tool.returnSchema, null, 2)}
                                    </pre>
                                  </div>
                                </div>

                                {/* Tech depth */}
                                <div>
                                  <div className="text-[10px] font-mono text-ink-faint uppercase mb-2">Tech Depth</div>
                                  <div className="space-y-1.5">
                                    {tool.techDepth.map((point, i) => (
                                      <div key={i} className="flex items-start gap-2.5 text-xs text-ink-muted leading-relaxed">
                                        <span className="text-accent-blue font-mono text-[10px] flex-shrink-0 mt-0.5">
                                          {String(i + 1).padStart(2, "0")}
                                        </span>
                                        <span>{point}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Footer badges */}
                                <div className="flex items-center gap-3 pt-2 border-t border-border
                                                text-[10px] font-mono text-ink-faint flex-wrap">
                                  <span className="text-accent-green">✓ Pydantic validated</span>
                                  <span>·</span>
                                  <span className="text-accent-blue">✓ HMAC secured</span>
                                  <span>·</span>
                                  <span className="text-accent-gold">✓ Langfuse traced</span>
                                  <span>·</span>
                                  <span className="text-violet-500">✓ DLQ on failure</span>
                                  {tool.dlqCount > 0 && (
                                    <>
                                      <span>·</span>
                                      <span className="text-accent-red">⚠ {tool.dlqCount} in DLQ</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Tab: Pipeline ──────────────────────────────────────────── */}
        {activeTab === "pipeline" && (
          <div className="space-y-4">
            <div className="p-5 rounded-xl border border-border bg-surface-1">
              <div className="text-xs font-mono text-ink-faint uppercase mb-4">
                End-to-end request flow — user message to cited answer with optional doc + email
              </div>
              <div className="space-y-2">
                {PIPELINE_STEPS.map(step => (
                  <div key={step.n}
                       className="flex items-start gap-3 p-3 rounded-lg bg-surface-2 border border-border">
                    <span className="text-[10px] font-mono font-bold text-accent-blue bg-accent-blue/10
                                     border border-accent-blue/20 px-1.5 py-0.5 rounded flex-shrink-0">
                      {step.n}
                    </span>
                    <div>
                      <p className="text-[12px] font-medium text-ink leading-snug">{step.label}</p>
                      <p className="text-[11px] font-mono text-ink-faint mt-0.5 leading-relaxed">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-5 rounded-xl border border-border bg-surface-1">
                <div className="text-xs font-mono text-ink-faint uppercase mb-3">
                  Vectorless RAG — why no vector DB
                </div>
                <div className="space-y-2 text-xs text-ink-muted leading-relaxed">
                  <p><strong className="text-ink">BM25Okapi</strong> — probabilistic keyword ranking. TF-IDF with document-length normalisation. In-memory, rebuilt on every index. Zero external service.</p>
                  <p><strong className="text-ink">SQLite FTS5</strong> — Porter stemmer. Boolean and phrase queries. Handles inflection. Single file, zero infrastructure.</p>
                  <p><strong className="text-ink">MS-MARCO cross-encoder</strong> — transformer inference on every (query, chunk) pair. Semantic relevance, not cosine similarity. This IS the semantic layer.</p>
                  <p className="text-[10px] font-mono text-ink-faint pt-2 border-t border-border">
                    Three free libraries replace a $70/month vector DB with equal or better accuracy for this corpus size.
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-xl border border-border bg-surface-1">
                <div className="text-xs font-mono text-ink-faint uppercase mb-3">
                  Document + Email pipeline
                </div>
                <div className="space-y-2 text-[11px] text-ink-muted leading-relaxed font-mono">
                  {[
                    "generate_document → python-docx / python-pptx",
                    "file saved to /tmp/generated/{title}_{uid}.docx",
                    "file read back → base64.b64encode(bytes)",
                    "content_b64 stored as pendingAttachment in route.ts",
                    "send_email_summary called next in agent loop",
                    "pendingAttachment injected → consumed (set null)",
                    "MIMEMultipart('mixed') → MIMEBase attachment",
                    "Gmail SMTP STARTTLS port 587 → delivered",
                    "SSE done event → generatedDocs[] → download button",
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-accent-blue opacity-60 flex-shrink-0">{String(i + 1).padStart(2, "0")}</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-border bg-surface-1">
              <div className="text-xs font-mono text-ink-faint uppercase mb-3">
                Security on every MCP call
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-ink-muted">
                {[
                  { label: "HMAC-SHA256 signing",  detail: "Body hash + timestamp + nonce in X-Signature, X-Timestamp, X-Nonce headers. Server verifies on every request." },
                  { label: "30s replay window",    detail: "Timestamp checked against server time. Captured requests expire in 30 seconds and become useless." },
                  { label: "PII scrubbing",        detail: "All error messages and DLQ payloads regex-scrubbed before logging. Card numbers, SSNs, API keys removed." },
                  { label: "DLQ + retry",          detail: "3 retries with exponential backoff + jitter. Failed calls enqueued to /mcp/dlq with full context for audit." },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-lg bg-surface-2 border border-border">
                    <div className="font-semibold text-ink text-[11px] mb-1">{s.label}</div>
                    <div className="text-[11px] text-ink-faint leading-relaxed">{s.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Claude Desktop ────────────────────────────────────── */}
        {activeTab === "desktop" && (
          <div className="space-y-4">

            {/* Screenshot */}
            <div className="rounded-xl border border-border bg-surface-1 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface-2">
                <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
                <span className="text-[11px] font-mono text-ink-muted">
                  Claude Desktop · Customize · amex-insight LOCAL DEV · 9 tools · Always allow
                </span>
              </div>
              <img
                src="/Claude-MCP.png"
                alt="Claude Desktop showing amex-insight MCP server with all 9 tools: search_financial_docs, get_document_page, compare_benchmarks, validate_faithfulness, extract_kpis, index_document_page, list_index, generate_document, send_email_summary"
                className="w-full object-cover"
              />
            </div>

            <div className="p-5 rounded-xl border border-accent-blue/20 bg-accent-blue/5">
              <div className="flex items-center gap-2 mb-3">
                <Cpu className="w-4 h-4 text-accent-blue" />
                <span className="text-sm font-heading font-semibold text-ink">
                  Claude Desktop MCP Connector
                </span>
                <span className="text-[10px] font-mono text-accent-blue/70 px-2 py-0.5 rounded
                                 border border-accent-blue/20 bg-accent-blue/5">
                  stdio transport
                </span>
              </div>
              <p className="text-sm text-ink-muted leading-relaxed mb-4">
                AmexInsight exposes all 9 tools over MCP stdio protocol. Open Claude.app on your Mac
                and ask any financial question — Claude natively calls search_financial_docs, validates
                faithfulness, generates docs, and sends emails. Zero extra infrastructure.
              </p>
              <div className="text-[10px] font-mono text-ink-faint uppercase mb-2">
                ~/Library/Application Support/Claude/claude_desktop_config.json
              </div>
              <pre className="text-[11px] font-mono text-ink-muted bg-surface-1 rounded-lg p-4
                              border border-border overflow-x-auto leading-relaxed">
{`{
  "mcpServers": {
    "amex-insight": {
      "command": "/path/to/.venv/bin/python",
      "args": ["-m", "mcp_stdio"],
      "cwd": "/path/to/amex-insight-mcp",
      "env": {
        "GMAIL_USER": "your@gmail.com",
        "GMAIL_APP_PASS": "xxxx xxxx xxxx xxxx",
        "DB_PATH": "/path/to/amex-insight-mcp/data/chunks.db",
        "BM25_PATH": "/path/to/amex-insight-mcp/data/bm25.pkl"
      }
    }
  }
}`}
              </pre>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-5 rounded-xl border border-border bg-surface-1">
                <div className="text-xs font-mono text-ink-faint uppercase mb-3">HTTP Mode (Production)</div>
                <div className="space-y-2 text-xs text-ink-muted leading-relaxed">
                  <p><strong className="text-ink">Transport:</strong> REST — POST /mcp/call</p>
                  <p><strong className="text-ink">Auth:</strong> HMAC-SHA256 signed headers on every request</p>
                  <p><strong className="text-ink">Deployed:</strong> Azure App Service — Canada Central</p>
                  <p><strong className="text-ink">Called by:</strong> Next.js API route (amex-insight.vercel.app)</p>
                  <p><strong className="text-ink">Timeout:</strong> 25s per tool call, 3 retries with backoff</p>
                </div>
              </div>

              <div className="p-5 rounded-xl border border-border bg-surface-1">
                <div className="text-xs font-mono text-ink-faint uppercase mb-3">stdio Mode (Claude Desktop)</div>
                <div className="space-y-2 text-xs text-ink-muted leading-relaxed">
                  <p><strong className="text-ink">Transport:</strong> JSON-RPC over stdin/stdout</p>
                  <p><strong className="text-ink">Entry point:</strong> mcp_stdio.py — FastMCP.run(transport=&quot;stdio&quot;)</p>
                  <p><strong className="text-ink">Tools:</strong> Identical 9 tools — same Python logic</p>
                  <p><strong className="text-ink">Models:</strong> Lazy-loaded on first call — fast startup</p>
                  <p><strong className="text-ink">Env:</strong> GMAIL_USER, GMAIL_APP_PASS in claude_desktop_config.json</p>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-border bg-surface-1">
              <div className="text-xs font-mono text-ink-faint uppercase mb-3">
                MCP stdio — how it works
              </div>
              <div className="space-y-2">
                {[
                  { n: "01", label: "Claude Desktop spawns mcp_stdio.py as a subprocess",           detail: "config specifies command, args, cwd, env. Claude Desktop manages the process lifecycle." },
                  { n: "02", label: "FastMCP listens on stdin for JSON-RPC tool calls",             detail: "mcp.run(transport='stdio', show_banner=False) — banner suppressed to keep stdio clean." },
                  { n: "03", label: "All @mcp.tool() decorated functions are registered",          detail: "Same 9 tools as the HTTP server. FastMCP auto-generates the MCP schema from type hints." },
                  { n: "04", label: "Models lazy-load on first call",                               detail: "CrossEncoder and BM25 index loaded on first search_financial_docs call — not at startup. Prevents Claude Desktop timeout." },
                  { n: "05", label: "Tool results returned as JSON over stdout",                    detail: "FastMCP serialises the Pydantic model_dump() result to JSON-RPC response format." },
                  { n: "06", label: "Claude synthesises the answer using retrieved context",        detail: "Same faithfulness rules apply — Claude Desktop version follows identical system prompt constraints." },
                ].map(step => (
                  <div key={step.n}
                       className="flex items-start gap-3 p-3 rounded-lg bg-surface-2 border border-border">
                    <span className="text-[10px] font-mono font-bold text-accent-blue bg-accent-blue/10
                                     border border-accent-blue/20 px-1.5 py-0.5 rounded flex-shrink-0">
                      {step.n}
                    </span>
                    <div>
                      <p className="text-[12px] font-medium text-ink leading-snug">{step.label}</p>
                      <p className="text-[11px] font-mono text-ink-faint mt-0.5 leading-relaxed">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-heading font-semibold text-emerald-700">
                  Same tools, two surfaces
                </span>
              </div>
              <p className="text-xs text-emerald-700 leading-relaxed">
                The HTTP MCP server and stdio MCP server share the same underlying tool implementations
                in tools/*.py. Any improvement to search accuracy, email formatting, or document
                generation is immediately available in both the web app and Claude Desktop — zero duplication.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
