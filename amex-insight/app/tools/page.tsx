"use client"

import { useEffect, useState } from "react"
import { Server, Zap, CheckCircle, Clock, AlertCircle, RefreshCw } from "lucide-react"
import { clsx } from "clsx"

interface ToolDef {
  name:        string
  description: string
  inputSchema: Record<string, unknown>
  callsToday:  number
  avgLatencyMs: number
  dlqCount:    number
}

interface McpStatus {
  status:   string
  tools:    number
  dlqDepth: number
  uptime:   number
}

const MOCK_TOOLS: ToolDef[] = [
  {
    name:         "search_financial_docs",
    description:  "Search AMEX public financial documents using hybrid BM25 + FTS5 + cross-encoder reranking. Returns grounded chunks with page-level citations.",
    inputSchema:  { query: "string", top_k: "number (default 8)", year_filter: "number (optional)" },
    callsToday:   847,
    avgLatencyMs: 182,
    dlqCount:     0,
  },
  {
    name:         "get_document_page",
    description:  "Retrieve the full text of a specific page from a financial document for deeper grounding after initial search.",
    inputSchema:  { doc_id: "string", page_num: "number" },
    callsToday:   234,
    avgLatencyMs: 48,
    dlqCount:     0,
  },
  {
    name:         "index_document_page",
    description:  "Ingest a new document page into the vectorless RAG index. Runs the full pipeline: tokenise → SQLite FTS5 upsert (Porter stemming) → BM25Okapi corpus rebuild → metadata store → FTS5 read-back verify. Returns a full pipeline trace with step timings.",
    inputSchema:  { doc_id: "string", page_num: "number", text: "string", section: "string (optional)", context: "string (optional)" },
    callsToday:   12,
    avgLatencyMs: 38,
    dlqCount:     0,
  },
  {
    name:         "compare_benchmarks",
    description:  "Retrieve industry benchmark data for business expense category comparison across quarters.",
    inputSchema:  { category: "string", quarter: "string" },
    callsToday:   156,
    avgLatencyMs: 94,
    dlqCount:     0,
  },
  {
    name:         "validate_faithfulness",
    description:  "NLI-style faithfulness check: does the draft answer exist in the retrieved context? Returns score 0–1 and flagged claims.",
    inputSchema:  { answer: "string", context: "string[]" },
    callsToday:   612,
    avgLatencyMs: 94,
    dlqCount:     2,
  },
  {
    name:         "extract_kpis",
    description:  "Extract structured financial KPIs from a document — Pydantic-validated output with citations.",
    inputSchema:  { doc_id: "string" },
    callsToday:   89,
    avgLatencyMs: 340,
    dlqCount:     0,
  },
]

export default function ToolsPage() {
  const [status, setStatus]   = useState<McpStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/health")
      const data = await res.json()
      setStatus(data.mcp)
    } catch {
      setStatus({ status: "unreachable", tools: 0, dlqDepth: 0, uptime: 0 })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStatus() }, [])

  const online = status?.status !== "unreachable"

  return (
    <div className="min-h-screen bg-surface pt-14">
      <div className="fixed inset-0 bg-grid-subtle bg-grid-subtle opacity-30 pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full
                          border border-border bg-surface-2 mb-4">
            <span className="text-[10px] font-mono text-ink-faint uppercase tracking-widest">
              MCP Server · Registered Tools
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-heading font-bold text-3xl mb-2">
                <span className="gradient-blue">MCP Tools</span>
              </h1>
              <p className="text-ink-muted text-sm">
                Python FastAPI MCP server · Railway · 5 tools · Pydantic on every I/O
              </p>
            </div>
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border
                         bg-surface-2 hover:bg-surface-3 transition-colors text-sm text-ink-muted
                         disabled:opacity-40"
            >
              <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        {/* Server status */}
        <div className={clsx(
          "flex items-center justify-between p-4 rounded-xl border mb-8",
          online
            ? "bg-accent-green/5 border-accent-green/15"
            : "bg-accent-red/5 border-accent-red/15"
        )}>
          <div className="flex items-center gap-3">
            <Server className={clsx("w-5 h-5", online ? "text-accent-green" : "text-accent-red")} />
            <div>
              <div className="font-heading font-semibold text-sm text-ink">
                amex-insight-mcp
              </div>
              <div className="text-[11px] font-mono text-ink-faint">
                Python · FastAPI · FastMCP · Railway
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {[
              { label: "Status",   value: status?.status ?? "—", color: online ? "green" : "red" },
              { label: "Tools",    value: String(status?.tools ?? MOCK_TOOLS.length) },
              { label: "DLQ",      value: String(status?.dlqDepth ?? 0), color: (status?.dlqDepth ?? 0) > 0 ? "red" : "green" },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className={clsx(
                  "text-sm font-mono font-bold",
                  s.color === "green" ? "text-accent-green" :
                  s.color === "red"   ? "text-accent-red"   : "text-ink-muted"
                )}>
                  {s.value}
                </div>
                <div className="text-[10px] font-mono text-ink-faint">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tools list */}
        <div className="space-y-3">
          {MOCK_TOOLS.map(tool => (
            <div key={tool.name} className="rounded-xl border border-border bg-surface-1 overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === tool.name ? null : tool.name)}
                className="w-full flex items-start justify-between p-4
                           hover:bg-surface-2 transition-colors text-left"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-accent-blue/10 border border-accent-blue/15
                                  flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Zap className="w-3.5 h-3.5 text-accent-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-semibold text-sm text-ink mb-1">
                      {tool.name}
                    </div>
                    <p className="text-xs text-ink-muted leading-relaxed truncate">
                      {tool.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-mono text-ink-muted">{tool.callsToday.toLocaleString()}</div>
                    <div className="text-[10px] font-mono text-ink-faint">calls today</div>
                  </div>
                  <div className="text-right">
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

              {expanded === tool.name && (
                <div className="px-4 pb-4 border-t border-border pt-4 space-y-3">
                  <div>
                    <div className="text-[10px] font-mono text-ink-faint uppercase mb-2">Input Schema</div>
                    <pre className="text-xs font-mono text-ink-muted bg-surface-2 rounded-lg p-3
                                    border border-border overflow-x-auto">
                      {JSON.stringify(tool.inputSchema, null, 2)}
                    </pre>
                  </div>
                  <div className="text-xs font-mono text-ink-muted leading-relaxed">
                    {tool.description}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-ink-faint">
                    <span className="text-accent-green">✓ Pydantic validated</span>
                    <span>·</span>
                    <span className="text-accent-blue">✓ HMAC secured</span>
                    <span>·</span>
                    <span className="text-accent-gold">✓ Langfuse traced</span>
                    {tool.dlqCount > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-accent-red">⚠ {tool.dlqCount} in DLQ</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Vectorless architecture note */}
        <div className="mt-10 space-y-3">
          <div className="p-5 rounded-xl border border-border bg-surface-1">
            <div className="text-xs font-mono text-ink-faint uppercase mb-3">
              Vectorless RAG — index_document_page pipeline
            </div>
            <div className="space-y-2">
              {[
                { step: "01", label: "Pydantic validation",     detail: "doc_id, page_num, text, section sanitised before touching the index" },
                { step: "02", label: "Chunk ID generation",     detail: "{doc_id}_p{page_num} — deterministic, collision-safe" },
                { step: "03", label: "Tokenisation",            detail: "Whitespace split + lowercase — mirrors BM25Okapi corpus format" },
                { step: "04", label: "SQLite FTS5 upsert",      detail: "Porter stemming, full-text index — handles 'investing' = 'invest' = 'investment'" },
                { step: "05", label: "BM25Okapi rebuild",       detail: "In-memory ranked keyword model rebuilt from full corpus after each ingest" },
                { step: "06", label: "Metadata upsert",         detail: "chunks_meta table — raw text + context prefix for cross-encoder input" },
                { step: "07", label: "FTS5 read-back verify",   detail: "Probe query confirms chunk is retrievable before returning success" },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-3">
                  <span className="text-[10px] font-mono text-accent-blue/60 w-5 flex-shrink-0 pt-0.5">{s.step}</span>
                  <div>
                    <span className="text-[12px] font-mono font-semibold text-ink">{s.label}</span>
                    <span className="text-[11px] text-ink-faint ml-2">{s.detail}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border text-[11px] font-mono text-ink-faint">
              No embeddings · No vector DB · No ANN index · BM25+FTS5 = exact recall · Cross-encoder = semantic ranking at query time
            </div>
          </div>

          <div className="p-5 rounded-xl border border-border bg-surface-1">
            <div className="text-xs font-mono text-ink-faint uppercase mb-3">Why Python for the MCP server?</div>
            <p className="text-sm text-ink-muted leading-relaxed">
              FastAPI + Pydantic is the same stack running at Lawline.tech and Resso.ai.
              sentence-transformers cross-encoder, rank_bm25, and SQLite FTS5 are Python-native —
              zero context switching. The MCP protocol boundary between Next.js and Python is clean:
              one service reasons, the other retrieves.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
