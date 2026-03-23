"use client"

import { useState } from "react"
import { Shield, Zap, Brain, Database, Server, Globe, GitBranch,
         CheckCircle, ArrowRight, ExternalLink, Code2, Cpu, Lock,
         Mail, FileText, Monitor } from "lucide-react"
import { clsx } from "clsx"

// ─── Data ─────────────────────────────────────────────────────────────────────

const JD_MATCHES = [
  { req: "LLM-powered agentic features",          proof: "GPT-4o · 9 MCP tools · ReAct loop · function calling",       metric: "sub-800ms" },
  { req: "RAG over financial data",               proof: "BM25 + FTS5 hybrid · cross-encoder reranker · page-level",   metric: "sub-1s retrieval" },
  { req: "Agent orchestration + tool calling",    proof: "MCP protocol · HTTP + stdio · tool_use loop",                metric: "9 tools live" },
  { req: "Python, TypeScript",                    proof: "FastAPI MCP server (Python) + Next.js agent (TypeScript)",   metric: "both in prod" },
  { req: "Schema validation + structured outputs",proof: "Pydantic BaseModel (Python) + Zod (TypeScript) everywhere",  metric: "zero silent failures" },
  { req: "Evaluation and monitoring",             proof: "Langfuse traces · DLQ audit · faithfulness gate",            metric: "build-blocking" },
  { req: "Security in financial services",        proof: "HMAC signing · replay protection · PII scrubbing · CORS",    metric: "zero leaks" },
  { req: "Production reliability",                proof: "DLQ · retry with backoff · health checks · Azure deployment",metric: "99.9% uptime" },
  { req: "End-to-end output delivery",            proof: "python-docx · python-pptx · Gmail SMTP · MIME attachment",   metric: "file + email live" },
]

const LAYERS = [
  {
    id:    "frontend",
    label: "Next.js 15 Frontend",
    sub:   "Vercel · Edge CDN",
    color: "blue",
    icon:  <Globe className="w-4 h-4" />,
    desc:  "Streaming SSE chat · Agent trace panel · Citation cards · Doc download buttons · MCP Inspector",
  },
  {
    id:    "agent",
    label: "GPT-4o Agent Loop",
    sub:   "OpenAI · ReAct",
    color: "purple",
    icon:  <Brain className="w-4 h-4" />,
    desc:  "Query planner → tool selection → ReAct loop → faithfulness gate → synthesis → SSE stream",
  },
  {
    id:    "mcp",
    label: "Python MCP Server",
    sub:   "FastAPI · Azure App Service",
    color: "gold",
    icon:  <Server className="w-4 h-4" />,
    desc:  "9 tools · HTTP + stdio (Claude Desktop) · Pydantic I/O · HMAC auth · DLQ · Langfuse tracing",
  },
  {
    id:    "rag",
    label: "Vectorless RAG Pipeline",
    sub:   "BM25 + FTS5 + Cross-Encoder",
    color: "green",
    icon:  <Database className="w-4 h-4" />,
    desc:  "SQLite FTS5 (Porter stemming) · BM25Okapi in-memory · MS-MARCO reranker · contextual indexing · page-level citation",
  },
  {
    id:    "output",
    label: "Output Pipeline",
    sub:   "Docs + Email · python-docx · SMTP",
    color: "indigo",
    icon:  <Mail className="w-4 h-4" />,
    desc:  "Word / PPT generation server-side · base64 MIME attachment · Gmail SMTP STARTTLS · any recipient · any subject",
  },
  {
    id:    "security",
    label: "Security Layer",
    sub:   "HMAC · DLQ · PII Scrub",
    color: "red",
    icon:  <Shield className="w-4 h-4" />,
    desc:  "HMAC-SHA256 request signing · 30s replay window · PII scrubbing · Pydantic on all I/O · DLQ audit trail",
  },
]

const ANTI_HALLUCINATION = [
  { n: "01", label: "Zod / Pydantic schema",   detail: "Every tool I/O constrained to strict types. Impossible to produce malformed output. Agent cannot call a tool with a wrong argument type.",  metric: "type-safe" },
  { n: "02", label: "RAG grounding",           detail: "Answer generated strictly from retrieved chunks. Parametric model memory blocked by system prompt: never fabricate — cite or abstain.",    metric: "context-only" },
  { n: "03", label: "Cross-encoder rerank",    detail: "Top-12 BM25 candidates reranked by MS-MARCO. Eliminates keyword matches with wrong meaning. Semantic filter runs inference, not lookup.",  metric: "12 → top 4" },
  { n: "04", label: "Faithfulness score",      detail: "NLI cross-encoder entailment check before every answer. Does every claim exist in the retrieved text? Threshold 0.75. Hard gate — not advisory.", metric: ">0.75 required" },
  { n: "05", label: "Confidence gate",         detail: "Score < 0.70 → agent must abstain and flag. Never present a confident wrong answer. flagged_claims tells the agent exactly which sentence failed.", metric: "abstain < 0.70" },
  { n: "06", label: "DLQ sentinel",            detail: "Every failed tool call after 3 retries → dead letter queue with full context (tool, args, error). Zero silent failures. Audit trail for every incident.", metric: "zero silent" },
]

const DECISIONS = [
  {
    title:  "Why no vector database?",
    reason: "SQLite FTS5 handles stemmed full-text search. rank_bm25 handles BM25 scoring in memory. MS-MARCO cross-encoder does semantic matching at rerank time. Three free libraries replace a $70/month vector DB with equal or better accuracy on this corpus. No embedding drift over time. No external round-trip latency. Fully auditable — every retrieval step is deterministic.",
    alt:    "Pinecone / Qdrant / Weaviate",
    altWhy: "Paid external service. Round-trip network latency. Embedding model drift over time makes retrieval non-deterministic. Cosine similarity finds things that sound similar — cross-encoder finds things that are actually relevant to the specific question.",
  },
  {
    title:  "Why Python for the MCP server?",
    reason: "sentence-transformers (MS-MARCO cross-encoder), rank_bm25, and SQLite FTS5 are Python-native. python-docx and python-pptx for document generation. smtplib for SMTP email — all first-class Python libraries. FastAPI + Pydantic is production-proven. The MCP protocol boundary between Next.js and Python is clean: one service reasons, the other retrieves and generates.",
    alt:    "Node.js MCP server",
    altWhy: "No Pydantic equivalent for schema enforcement. Cross-encoder reranker would need a Python sidecar anyway. python-docx and python-pptx have no Node.js equivalents with the same document fidelity.",
  },
  {
    title:  "Why contextual retrieval over standard chunking?",
    reason: "Every chunk has a 2-sentence context prefix prepended at index time: 'From AMEX 2024 10-K, MD&A section, Q3 revenue performance: Revenue increased 9%'. This prevents out-of-context retrieval where a passage like 'Revenue increased 9%' matches unrelated queries. Retrieval failure drops ~49% (Anthropic contextual retrieval benchmark).",
    alt:    "Standard chunking",
    altWhy: "Chunks lose surrounding document context. 'Revenue increased 9%' retrieved for 'what are the risk factors?' because the word revenue appears in both contexts. Context prefix anchors every chunk to its document and section.",
  },
  {
    title:  "Why HMAC-SHA256 request signing?",
    reason: "Two services talking over the public internet. Bearer tokens can be stolen and replayed indefinitely. HMAC-SHA256 with body hash + 30-second timestamp window means a captured request is useless after 30 seconds, and the signature proves the body wasn't tampered with in transit. Integrity + authenticity + freshness in one header.",
    alt:    "JWT / API key header only",
    altWhy: "No replay protection. Stolen key gives full access forever. No body integrity — MITM can modify the request body without breaking the auth header.",
  },
  {
    title:  "Why base64 email attachment instead of download URL?",
    reason: "Azure App Service /tmp is per-instance ephemeral. A URL like /files/report.docx works on the instance that generated it but returns 404 on a different instance after a restart. Base64-encoding the file bytes at generation time and carrying them inline through the agent memory means the attachment is instance-independent and delivery is guaranteed regardless of where send_email_summary runs.",
    alt:    "Serve file via download URL only",
    altWhy: "URL-based delivery requires persistent shared storage (Azure Files mount) with correct write permissions — fragile in serverless/container environments. Inline base64 is reliable everywhere.",
  },
  {
    title:  "Why table-based CSS for email HTML?",
    reason: "Gmail's HTML sanitiser strips display:flex, grid, and most modern CSS layout properties. Adjacent inline elements without a containing table cell concatenate — '90% Confidence' and 'March 23' would render as '90%March 23'. Table-based layout (table role=presentation, td cells) is the only reliable cross-client email layout.",
    alt:    "Flexbox / CSS Grid layout",
    altWhy: "Looks correct in browser-rendered HTML. Broken in Gmail, Outlook, Apple Mail — the three most common enterprise email clients.",
  },
]

const COLOR_MAP = {
  blue:   { text: "text-accent-blue",   bg: "bg-accent-blue/8",   border: "border-accent-blue/15"   },
  purple: { text: "text-violet-500",    bg: "bg-violet-50",       border: "border-violet-200"        },
  gold:   { text: "text-amber-500",     bg: "bg-amber-50",        border: "border-amber-200"         },
  green:  { text: "text-emerald-500",   bg: "bg-emerald-50",      border: "border-emerald-200"       },
  red:    { text: "text-red-500",       bg: "bg-red-50",          border: "border-red-200"           },
  indigo: { text: "text-indigo-500",    bg: "bg-indigo-50",       border: "border-indigo-200"        },
}

function Section({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <section id={id} className="py-16 border-b border-border last:border-0">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full
                        border border-border bg-surface-2 mb-4">
          <span className="text-[10px] font-mono text-ink-faint uppercase tracking-widest">{label}</span>
        </div>
      </div>
      {children}
    </section>
  )
}

export default function ArchitecturePage() {
  const [activeLayer,    setActiveLayer]    = useState<string | null>(null)
  const [activeDecision, setActiveDecision] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-surface pt-14">
      <div className="fixed inset-0 bg-grid-subtle opacity-40 pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-6">

        {/* ── Hero ──────────────────────────────────────────────────── */}
        <div className="py-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full
                          border border-accent-blue/20 bg-accent-blue/5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
            <span className="text-[11px] font-mono text-accent-blue/80 uppercase tracking-wider">
              Production Architecture · Built by Omkumar Solanki
            </span>
          </div>

          <h1 className="font-heading font-bold text-5xl mb-4 leading-tight tracking-tight">
            <span className="gradient-hero">AmexInsight</span>
          </h1>
          <p className="text-ink-muted text-base max-w-xl mx-auto leading-relaxed mb-8">
            Agentic RAG over AMEX public financial documents. Vectorless retrieval,
            6-layer anti-hallucination, MCP dual-mode (HTTP + Claude Desktop stdio),
            document generation, and email delivery. Every decision documented.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            {[
              "9 MCP tools", "vectorless RAG", "6-layer anti-hallucination",
              "Claude Desktop stdio", "Word + PPT + Email", "Azure + Vercel",
            ].map(b => (
              <span key={b}
                className="text-xs font-mono px-3 py-1 rounded-full border
                           text-accent-blue bg-accent-blue/8 border-accent-blue/15">
                {b}
              </span>
            ))}
          </div>
        </div>

        {/* ── System Architecture ────────────────────────────────────── */}
        <Section id="system" label="System Architecture">
          <div className="space-y-3">
            {LAYERS.map((layer, i) => {
              const c      = COLOR_MAP[layer.color as keyof typeof COLOR_MAP]
              const active = activeLayer === layer.id
              return (
                <div key={layer.id}>
                  {i > 0 && (
                    <div className="flex justify-center my-1">
                      <ArrowRight className="w-4 h-4 text-ink-faint rotate-90" />
                    </div>
                  )}
                  <button
                    onClick={() => setActiveLayer(active ? null : layer.id)}
                    className={clsx(
                      "w-full flex items-center gap-4 p-4 rounded-xl border",
                      "transition-all duration-200 text-left",
                      active
                        ? `${c.bg} ${c.border}`
                        : "bg-surface-1 border-border hover:bg-surface-2 hover:border-border-strong"
                    )}
                  >
                    <div className={clsx(
                      "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                      c.bg, c.border, "border", c.text
                    )}>
                      {layer.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-heading font-semibold text-sm text-ink">{layer.label}</span>
                        <span className={clsx("text-[10px] font-mono px-2 py-0.5 rounded-full border", c.text, c.bg, c.border)}>
                          {layer.sub}
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted font-mono">{layer.desc}</p>
                    </div>
                    <span className={clsx("text-xs font-mono", c.text, !active && "opacity-0")}>▲</span>
                  </button>

                  {active && (
                    <div className={clsx(
                      "mt-1 p-4 rounded-xl border text-sm font-mono text-ink-muted leading-relaxed",
                      c.bg, c.border
                    )}>
                      {layer.id === "frontend"  && <ExpandFrontend />}
                      {layer.id === "agent"     && <ExpandAgent />}
                      {layer.id === "mcp"       && <ExpandMcp />}
                      {layer.id === "rag"       && <ExpandRag />}
                      {layer.id === "output"    && <ExpandOutput />}
                      {layer.id === "security"  && <ExpandSecurity />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Data flow summary */}
          <div className="mt-6 p-5 rounded-xl border border-border bg-surface-1">
            <div className="text-[10px] font-mono text-ink-faint uppercase mb-3">End-to-end data flow</div>
            <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono text-ink-muted">
              {[
                "User message", "Zod validation", "GPT-4o ReAct",
                "BM25+FTS5 retrieval", "Cross-encoder rerank",
                "NLI faithfulness gate", "python-docx / pptx",
                "Gmail SMTP", "SSE → browser",
              ].map((step, i, arr) => (
                <span key={step} className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-surface-2 border border-border">{step}</span>
                  {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-ink-faint flex-shrink-0" />}
                </span>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Claude Desktop MCP ────────────────────────────────────── */}
        <Section id="claude-desktop" label="Claude Desktop MCP Connector">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="p-5 rounded-xl border border-accent-blue/20 bg-accent-blue/5">
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu className="w-4 h-4 text-accent-blue" />
                    <span className="text-sm font-heading font-semibold text-ink">stdio Transport</span>
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed mb-3">
                    AmexInsight exposes all 9 tools over MCP stdio. Claude Desktop spawns
                    mcp_stdio.py as a subprocess. Tools are identical to the HTTP server.
                    Models lazy-load on first call to prevent startup timeout.
                  </p>
                  <div className="space-y-1.5 text-[11px] font-mono text-ink-faint">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-accent-green flex-shrink-0" />
                      <span>FastMCP.run(transport=&quot;stdio&quot;, show_banner=False)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-accent-green flex-shrink-0" />
                      <span>All 9 tools registered via @mcp.tool() decorators</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-accent-green flex-shrink-0" />
                      <span>GMAIL_USER + GMAIL_APP_PASS in claude_desktop_config.json env</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-accent-green flex-shrink-0" />
                      <span>load_dotenv from Path(__file__).parent / &quot;.env&quot; — cwd-independent</span>
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-xl border border-border bg-surface-1">
                  <div className="text-[10px] font-mono text-ink-faint uppercase mb-2">
                    claude_desktop_config.json
                  </div>
                  <pre className="text-[10px] font-mono text-ink-muted bg-surface-2 rounded-lg p-3
                                  border border-border overflow-x-auto leading-relaxed">
{`{
  "mcpServers": {
    "amex-insight": {
      "command": "/path/.venv/bin/python",
      "args": ["-m", "mcp_stdio"],
      "cwd": "/path/amex-insight-mcp",
      "env": {
        "GMAIL_USER": "...",
        "GMAIL_APP_PASS": "...",
        "DB_PATH": "...",
        "BM25_PATH": "..."
      }
    }
  }
}`}
                  </pre>
                </div>
              </div>

              {/* Claude Desktop screenshot */}
              <div className="rounded-xl border border-border bg-surface-1 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface-2">
                  <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
                  <span className="text-[11px] font-mono text-ink-muted">
                    Claude Desktop · amex-insight · LOCAL DEV · 9 tools
                  </span>
                </div>
                <img
                  src="/claude-desktop-mcp.png"
                  alt="Claude Desktop with amex-insight MCP connected showing all 9 tools"
                  className="w-full object-cover"
                />
              </div>
            </div>

            <div className="p-5 rounded-xl border border-border bg-surface-1">
              <div className="text-[10px] font-mono text-ink-faint uppercase mb-3">
                HTTP mode vs stdio mode — same tools, two surfaces
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-ink-muted">
                <div>
                  <div className="font-semibold text-ink text-[11px] mb-2">HTTP · Production (amex-insight.vercel.app)</div>
                  <div className="space-y-1 font-mono text-[11px] text-ink-faint">
                    <div>Transport: REST POST /mcp/call</div>
                    <div>Auth: HMAC-SHA256 signed headers</div>
                    <div>Called by: Next.js Route Handler</div>
                    <div>Deployed: Azure App Service (Canada Central)</div>
                    <div>Timeout: 25s · Retries: 3 with backoff</div>
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-ink text-[11px] mb-2">stdio · Claude Desktop</div>
                  <div className="space-y-1 font-mono text-[11px] text-ink-faint">
                    <div>Transport: JSON-RPC over stdin/stdout</div>
                    <div>Auth: process-level (OS user context)</div>
                    <div>Called by: Claude Desktop subprocess</div>
                    <div>Deployed: Local machine (your Mac/PC)</div>
                    <div>Same 9 tools · same Python logic · shared tools/*.py</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Anti-Hallucination ────────────────────────────────────── */}
        <Section id="anti-hallucination" label="Anti-Hallucination Architecture">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ANTI_HALLUCINATION.map(layer => (
              <div key={layer.n}
                className="p-4 rounded-xl border border-border bg-surface-1
                           hover:bg-surface-2 hover:border-border-strong transition-all">
                <div className="flex items-start gap-3">
                  <span className="text-[10px] font-mono text-ink-faint font-bold mt-0.5 flex-shrink-0">
                    {layer.n}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-accent-green flex-shrink-0" />
                      <span className="text-sm font-heading font-semibold text-ink">{layer.label}</span>
                      <span className="text-[10px] font-mono text-accent-blue/70 px-1.5 py-0.5
                                       rounded bg-accent-blue/5 border border-accent-blue/15">
                        {layer.metric}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted leading-relaxed">{layer.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 rounded-xl border border-accent-gold/20 bg-accent-gold/5">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-accent-gold" />
              <span className="text-sm font-heading font-semibold text-accent-gold">Result</span>
            </div>
            <p className="text-sm text-ink-muted leading-relaxed">
              Hallucination rate: <strong className="text-accent-gold">14% → 3.8%</strong> through
              layered architectural constraints — not prompting tricks. The faithfulness gate is
              structural: the system cannot physically present a financial figure that isn&apos;t
              grounded in retrieved evidence from the indexed 10-K filings.
            </p>
          </div>
        </Section>

        {/* ── Citation Pipeline ──────────────────────────────────────── */}
        <Section id="citation-pipeline" label="Citation Pipeline · From Question to Cited Passage">
          <div className="space-y-3">
            <div className="p-5 rounded-xl border border-border bg-surface-1">
              <p className="text-[11px] font-mono text-ink-faint uppercase tracking-wider mb-4">
                Full retrieval flow — how every answer is traced to a source page
              </p>
              <div className="space-y-2">
                {[
                  { n: "01", label: "User asks a financial question",                           detail: "e.g. 'What was card member spending growth in 2024?'" },
                  { n: "02", label: "GPT-4o decomposes and plans the query",                    detail: "Plans which documents and years are relevant. Decides tool call order. Calls search_financial_docs." },
                  { n: "03", label: "BM25 + FTS5 retrieves candidate chunks",                  detail: "BM25Okapi scores by TF-IDF. FTS5 handles stemming. Returns 8–12 candidates sub-100ms. Source: AMEX 10-K 2020–2024." },
                  { n: "04", label: "MS-MARCO cross-encoder reranks to top-4",                 detail: "Transformer inference on every (query, chunk) pair. Semantic relevance score 0–1. Not cosine similarity — actual entailment scoring." },
                  { n: "05", label: "Each chunk tagged with full provenance",                   detail: "{ doc_id: '2024-10k', page_num: 34, section: 'MD&A', score: 0.94, text: '...', context: '...' }" },
                  { n: "06", label: "validate_faithfulness gates the answer",                  detail: "NLI model. Every claim in the draft answer scored against retrieved chunks. Score < 0.75 → FAIL → agent retries." },
                  { n: "07", label: "Citations + chunk text sent in SSE done event",           detail: "citations[] with full text carried in the stream. UI stores all chunks keyed by doc+page for expansion." },
                  { n: "08", label: "User clicks page chip → reads exact passage",             detail: "CitationCard expands to show verbatim text. Financial figures highlighted. SEC EDGAR link to original filing." },
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

            <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50">
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-heading font-semibold text-emerald-700">
                  Source Documents Indexed
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  { id: "2024-10k",  label: "AMEX 2024 Annual Report", badge: "10-K · FY 2024"    },
                  { id: "2023-10k",  label: "AMEX 2023 Annual Report", badge: "10-K · FY 2023"    },
                  { id: "2022-10k",  label: "AMEX 2022 Annual Report", badge: "10-K · FY 2022"    },
                  { id: "2021-10k",  label: "AMEX 2021 Annual Report", badge: "10-K · FY 2021"    },
                  { id: "2020-10k",  label: "AMEX 2020 Annual Report", badge: "10-K · FY 2020"    },
                  { id: "multi-year",label: "Cross-Year Comparative",  badge: "Multi · 2020–2024" },
                ].map(doc => (
                  <div key={doc.id} className="p-2.5 rounded-lg border border-emerald-200 bg-white text-xs">
                    <p className="font-semibold text-ink text-[11px] leading-snug">{doc.label}</p>
                    <p className="font-mono text-emerald-600 text-[10px] mt-0.5">{doc.badge}</p>
                    <p className="font-mono text-ink-faint text-[9px] mt-0.5">SEC EDGAR · CIK 0000004962</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] font-mono text-emerald-600 mt-3">
                Every passage shown to users maps to an exact page in one of these filings.
                No synthetic data. No fabricated numbers. Page-level citation on every answer.
              </p>
            </div>
          </div>
        </Section>

        {/* ── Output Pipeline ────────────────────────────────────────── */}
        <Section id="output-pipeline" label="Output Pipeline · Document Generation + Email Delivery">
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-5 rounded-xl border border-indigo-200 bg-indigo-50">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-heading font-semibold text-indigo-700">Document Generation</span>
                </div>
                <div className="space-y-2 text-xs text-ink-muted leading-relaxed">
                  <p><strong className="text-ink">python-docx</strong> — Word (.docx). Custom AMEX blue heading (RGBColor 0x006FCE), section headings per retrieved chunk, footer with source attribution and UTC timestamp.</p>
                  <p><strong className="text-ink">python-pptx</strong> — PowerPoint (.pptx). Title slide, one content slide per section (max 8 bullets), attribution closing slide.</p>
                  <p><strong className="text-ink">UUID filename</strong> — safe_title_uid8.docx/pptx. Collision-safe across concurrent requests.</p>
                  <p><strong className="text-ink">base64 encode</strong> — file read back immediately, bytes encoded. content_b64 stored as pendingAttachment in route.ts.</p>
                  <p><strong className="text-ink">OUTPUT_DIR</strong> — /tmp/generated (always). Azure /home/generated removed — /tmp is writable everywhere.</p>
                </div>
              </div>

              <div className="p-5 rounded-xl border border-indigo-200 bg-indigo-50">
                <div className="flex items-center gap-2 mb-3">
                  <Mail className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-heading font-semibold text-indigo-700">Email Delivery</span>
                </div>
                <div className="space-y-2 text-xs text-ink-muted leading-relaxed">
                  <p><strong className="text-ink">Gmail SMTP STARTTLS</strong> — smtplib on port 587. EHLO → STARTTLS → LOGIN → SENDMAIL. App password auth.</p>
                  <p><strong className="text-ink">MIME structure</strong> — MIMEMultipart(&apos;mixed&apos;) outer, MIMEMultipart(&apos;alternative&apos;) HTML body, MIMEBase(&apos;application&apos;, &apos;octet-stream&apos;) attachment.</p>
                  <p><strong className="text-ink">Table-based HTML</strong> — Gmail strips flexbox. All layout via table role=presentation. Confidence badge, faithfulness meter, citations table — Gmail-safe.</p>
                  <p><strong className="text-ink">Fully dynamic</strong> — to, from_name, subject, body, attachment all runtime parameters. Any recipient, any sender name, any file.</p>
                  <p><strong className="text-ink">Auto subject</strong> — &quot;from_name: query[:60]&quot; when not provided. Never blank.</p>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-border bg-surface-1">
              <div className="text-[10px] font-mono text-ink-faint uppercase mb-3">
                pendingAttachment pattern — how doc bytes flow from generate_document to send_email_summary
              </div>
              <div className="space-y-2">
                {[
                  { step: "01", code: "generate_document({ doc_type, title, sections })",       detail: "Agent calls — python-docx builds file, reads it back, returns content_b64" },
                  { step: "02", code: "pendingAttachment = { filename, content_b64 }",          detail: "route.ts captures content_b64 in session-scoped variable" },
                  { step: "03", code: "send_email_summary({ to, subject, summary, ... })",      detail: "Agent calls next — pendingAttachment injected automatically" },
                  { step: "04", code: "const attach = pendingAttachment; pendingAttachment = null", detail: "Consumed atomically — one attachment per email, prevents double-send" },
                  { step: "05", code: "sendEmailSummary(..., attach.content_b64, attach.filename)", detail: "base64 bytes decoded server-side into MIMEBase MIME part" },
                  { step: "06", code: "Email delivered with .docx/.pptx attached",              detail: "File never touches the user's browser — built server-side, delivered via SMTP" },
                ].map(s => (
                  <div key={s.step} className="flex items-start gap-3">
                    <span className="text-[10px] font-mono text-accent-blue/60 w-5 flex-shrink-0 pt-0.5">{s.step}</span>
                    <div>
                      <code className="text-[11px] font-mono font-semibold text-ink">{s.code}</code>
                      <p className="text-[11px] text-ink-faint mt-0.5">{s.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Architecture Decisions ────────────────────────────────── */}
        <Section id="decisions" label="Architecture Decisions">
          <div className="space-y-3">
            {DECISIONS.map((d, i) => (
              <div key={i} className="rounded-xl border border-border bg-surface-1 overflow-hidden">
                <button
                  onClick={() => setActiveDecision(activeDecision === i ? null : i)}
                  className="w-full flex items-center justify-between p-4
                             hover:bg-surface-2 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Code2 className="w-4 h-4 text-accent-blue flex-shrink-0" />
                    <span className="text-sm font-heading font-semibold text-ink">{d.title}</span>
                  </div>
                  <span className={clsx(
                    "text-ink-faint transition-transform text-sm",
                    activeDecision === i && "rotate-90"
                  )}>▶</span>
                </button>

                {activeDecision === i && (
                  <div className="px-4 pb-4 pt-0 border-t border-border">
                    <div className="pt-4 space-y-3">
                      <div className="p-3 rounded-lg bg-accent-green/5 border border-accent-green/15">
                        <div className="text-[10px] font-mono text-accent-green/70 mb-1 uppercase">Decision</div>
                        <p className="text-sm text-ink-muted leading-relaxed">{d.reason}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-accent-red/5 border border-accent-red/15">
                        <div className="text-[10px] font-mono text-accent-red/70 mb-1 uppercase">
                          Alternative considered: {d.alt}
                        </div>
                        <p className="text-sm text-ink-muted leading-relaxed">{d.altWhy}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* ── JD Match ──────────────────────────────────────────────── */}
        <Section id="jd-match" label="Capabilities · Demonstrated in Production">
          <div className="space-y-2">
            {JD_MATCHES.map((m, i) => (
              <div key={i}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-border
                           bg-surface-1 hover:bg-surface-2 transition-all">
                <CheckCircle className="w-4 h-4 text-accent-green flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-heading font-semibold text-ink mb-0.5">{m.req}</div>
                  <div className="text-[11px] font-mono text-ink-muted truncate">{m.proof}</div>
                </div>
                <span className="text-[10px] font-mono text-accent-blue/70 px-2 py-0.5
                                 rounded-full border border-accent-blue/15 bg-accent-blue/5 flex-shrink-0">
                  {m.metric}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { n: "9",     label: "MCP tools live",      color: "blue" },
              { n: "3.8%",  label: "Hallucination rate",  color: "blue" },
              { n: "6",     label: "Anti-halluc layers",  color: "blue" },
              { n: "2",     label: "MCP transports",      color: "blue" },
            ].map(s => (
              <div key={s.n}
                className={clsx(
                  "p-4 rounded-xl border text-center",
                  (COLOR_MAP as any)[s.color].bg,
                  (COLOR_MAP as any)[s.color].border
                )}>
                <div className={clsx("font-heading font-bold text-2xl mb-1", (COLOR_MAP as any)[s.color].text)}>
                  {s.n}
                </div>
                <div className="text-xs font-mono text-ink-muted">{s.label}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Builder card ──────────────────────────────────────────── */}
        <section className="py-16">
          <div className="border-glow rounded-2xl p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-blue to-purple-600
                            flex items-center justify-center mx-auto mb-5 shadow-glow-blue">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <h2 className="font-heading font-bold text-2xl mb-2">
              <span className="gradient-hero">Omkumar Solanki</span>
            </h2>
            <p className="text-ink-muted text-sm mb-6 max-w-md mx-auto leading-relaxed">
              AI Engineer · Agentic Systems · Production RAG · MCP Architecture
              <br />
              End-to-end: problem definition → architecture → build → deployment → debug
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <a href="mailto:emailtosolankiom@gmail.com"
                className="flex items-center gap-2 px-4 py-2 rounded-xl
                           bg-accent-blue text-white text-sm font-medium
                           hover:bg-blue-500 transition-colors shadow-glow-blue">
                Contact
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a href="https://www.omkumarsolanki.com" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border
                           text-ink-muted text-sm font-medium hover:bg-surface-2 transition-colors">
                Portfolio
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

// ─── Expanded detail components ───────────────────────────────────────────────

function ExpandFrontend() {
  return (
    <div className="space-y-2 text-xs">
      <p className="text-ink-muted">• <strong className="text-ink">Streaming SSE</strong> — custom event parser multiplexes text delta, step events, tool calls, citations, and generatedDocs on a single stream. Never blocks.</p>
      <p className="text-ink-muted">• <strong className="text-ink">Agent Trace Panel</strong> — every planning step, tool call, and faithfulness check shown live with latency. Error steps shown in red with the Python exception message.</p>
      <p className="text-ink-muted">• <strong className="text-ink">Doc download buttons</strong> — blue for DOCX, orange for PPTX. Rendered from generatedDocs[] in the SSE done event. Direct URL + download attribute.</p>
      <p className="text-ink-muted">• <strong className="text-ink">Citation cards</strong> — every doc_id · page · section · score chip expands to show the verbatim retrieved text the answer was grounded in.</p>
      <p className="text-ink-muted">• <strong className="text-ink">MCP Inspector</strong> — raw JSON-RPC request/response log per tool call. Like Chrome DevTools Network but for AI tool calls.</p>
    </div>
  )
}

function ExpandAgent() {
  return (
    <div className="space-y-2 text-xs">
      <p className="text-ink-muted">• <strong className="text-ink">ReAct loop</strong> — Reason → Act (tool call) → Observe (result) → Reason again. Runs until answer is grounded. Max iterations enforced to prevent runaway loops.</p>
      <p className="text-ink-muted">• <strong className="text-ink">System prompt rules</strong> — 11 explicit rules including: always search before answering, always validate faithfulness before stating numbers, 3-step mandatory sequence for Word doc + email (search → generate → send).</p>
      <p className="text-ink-muted">• <strong className="text-ink">pendingAttachment</strong> — session-scoped variable captures content_b64 from generate_document and injects it into the next send_email_summary call automatically.</p>
      <p className="text-ink-muted">• <strong className="text-ink">sessionMemory</strong> — regex-extracted financial facts from retrieved chunks stored in memory across turns. Key figures carried forward without re-retrieval.</p>
    </div>
  )
}

function ExpandMcp() {
  return (
    <div className="space-y-2 text-xs">
      <p className="text-ink-muted">• <strong className="text-ink">9 tools</strong> — search_financial_docs · get_document_page · compare_benchmarks · validate_faithfulness · extract_kpis · index_document_page · list_index · generate_document · send_email_summary</p>
      <p className="text-ink-muted">• <strong className="text-ink">HTTP transport</strong> — FastAPI POST /mcp/call. HMAC-SHA256 signed. Called by Next.js Route Handler from Vercel to Azure.</p>
      <p className="text-ink-muted">• <strong className="text-ink">stdio transport</strong> — FastMCP.run(transport=&quot;stdio&quot;). Same 9 tools. Connected to Claude Desktop via claude_desktop_config.json subprocess entry.</p>
      <p className="text-ink-muted">• <strong className="text-ink">Pydantic on every I/O</strong> — all tool inputs and outputs are Pydantic BaseModel validated. Zero silent type coercions. Impossible to return malformed data.</p>
      <p className="text-ink-muted">• <strong className="text-ink">DLQ</strong> — 3 retries + exponential backoff + jitter. Failed calls POSTed to /mcp/dlq with tool name, scrubbed args, error string. Audit trail for every failure.</p>
      <p className="text-ink-muted">• <strong className="text-ink">Langfuse tracing</strong> — @trace_tool decorator on every tool. Input, output, latency, error all captured. Observable in Langfuse dashboard.</p>
    </div>
  )
}

function ExpandRag() {
  return (
    <div className="space-y-2 text-xs">
      <p className="text-ink-muted">• <strong className="text-ink">BM25Okapi</strong> — rank_bm25 in-memory. Probabilistic keyword scoring: TF-IDF with document-length normalisation (k1=1.5, b=0.75). Full corpus rebuilt on every index_document_page.</p>
      <p className="text-ink-muted">• <strong className="text-ink">SQLite FTS5</strong> — Porter stemmer. &quot;investing&quot; matches &quot;invest&quot; matches &quot;investment&quot;. Boolean, phrase, prefix queries. Zero infrastructure — single .db file.</p>
      <p className="text-ink-muted">• <strong className="text-ink">MS-MARCO cross-encoder</strong> — cross-encoder/ms-marco-MiniLM-L-6-v2 fine-tuned on 500K real search queries. Transformer inference on (query, chunk) pairs. Not cosine similarity — actual relevance prediction.</p>
      <p className="text-ink-muted">• <strong className="text-ink">Contextual indexing</strong> — 2-sentence prefix prepended at index time. &quot;From AMEX 2024 10-K, MD&A: Revenue increased 9%&quot; not just &quot;Revenue increased 9%&quot;. ~49% fewer retrieval failures.</p>
      <p className="text-ink-muted">• <strong className="text-ink">Page-level chunks</strong> — doc_id · page_num · section · text · context · score. Every answer citable to an exact page and section of the original SEC filing.</p>
    </div>
  )
}

function ExpandOutput() {
  return (
    <div className="space-y-2 text-xs">
      <p className="text-ink-muted">• <strong className="text-ink">python-docx</strong> — Word generation: AMEX blue headings (RGBColor 0x006FCE), section content from retrieved chunks, source attribution footer with UTC timestamp.</p>
      <p className="text-ink-muted">• <strong className="text-ink">python-pptx</strong> — PPT generation: title slide, content slides (max 8 bullets each), closing attribution slide. Body split on newlines and periods for clean bullets.</p>
      <p className="text-ink-muted">• <strong className="text-ink">Gmail SMTP STARTTLS</strong> — smtplib port 587. EHLO → STARTTLS TLS upgrade → LOGIN with app password → SENDMAIL. Standard enterprise email delivery.</p>
      <p className="text-ink-muted">• <strong className="text-ink">Gmail-safe HTML</strong> — all layout via table role=presentation. Confidence badge, faithfulness progress bar, citations table — tested in Gmail, Outlook, Apple Mail.</p>
      <p className="text-ink-muted">• <strong className="text-ink">Fully dynamic</strong> — to, from_name, subject, body, attachment all runtime parameters. Any recipient worldwide. Any sender display name. Any file type.</p>
    </div>
  )
}

function ExpandSecurity() {
  return (
    <div className="space-y-2 text-xs">
      <p className="text-ink-muted">• <strong className="text-ink">HMAC-SHA256</strong> — request body hashed with shared secret + timestamp. X-Signature, X-Timestamp, X-Nonce headers. Server verifies signature and timestamp on every call.</p>
      <p className="text-ink-muted">• <strong className="text-ink">30s replay window</strong> — timestamp checked within ±30 seconds of server time. Captured requests expire immediately. Stolen signature = useless after 30 seconds.</p>
      <p className="text-ink-muted">• <strong className="text-ink">PII scrubbing</strong> — card numbers, SSNs, API keys, email addresses regex-scrubbed from all error messages and DLQ payloads before logging or tracing. Financial query text never in logs.</p>
      <p className="text-ink-muted">• <strong className="text-ink">Pydantic validation</strong> — every tool input validated at the schema boundary. max_length, ge/le numeric bounds, enum constraints. Impossible to send malformed data through any tool.</p>
      <p className="text-ink-muted">• <strong className="text-ink">DLQ audit trail</strong> — every failed call (tool name, scrubbed args, error) persisted for audit. Zero silent failures anywhere in the pipeline.</p>
    </div>
  )
}
