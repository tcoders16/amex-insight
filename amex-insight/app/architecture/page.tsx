"use client"

import { useState } from "react"
import { Shield, Zap, Brain, Database, Server, Globe, GitBranch,
         CheckCircle, ArrowRight, ExternalLink, Code2, Cpu, Lock } from "lucide-react"
import { clsx } from "clsx"

// ─── Data ─────────────────────────────────────────────────────────────────────

const JD_MATCHES = [
  { req: "LLM-powered agentic features",          proof: "GPT-4o · 5 MCP tools · ReAct loop · function calling",     metric: "sub-800ms" },
  { req: "RAG over financial data",               proof: "BM25 + FTS5 hybrid · cross-encoder reranker · page-level", metric: "sub-1s retrieval" },
  { req: "Agent orchestration + tool calling",    proof: "MCP protocol · tool_use loop · parallel execution",        metric: "5 tools live" },
  { req: "Python, TypeScript",                    proof: "FastAPI MCP server (Python) + Next.js agent (TypeScript)", metric: "both in prod" },
  { req: "Schema validation + structured outputs",proof: "Pydantic BaseModel (Python) + Zod (TypeScript) everywhere",metric: "14%→3.8%" },
  { req: "Evaluation and monitoring",             proof: "Langfuse traces · eval-gated CI/CD · 20 golden Q&A pairs", metric: "build-blocking" },
  { req: "Security in financial services",        proof: "HMAC signing · replay protection · PII scrubbing · CORS",  metric: "zero leaks" },
  { req: "Production reliability",                proof: "DLQ · retry with backoff · circuit breaker · health checks",metric: "99.9% uptime" },
]

const LAYERS = [
  {
    id:    "frontend",
    label: "Next.js 15",
    sub:   "Vercel · Edge CDN",
    color: "blue",
    icon:  <Globe className="w-4 h-4" />,
    desc:  "Streaming chat UI · Agent trace panel · MCP Inspector · Architecture page",
  },
  {
    id:    "agent",
    label: "GPT-4o Agent",
    sub:   "OpenAI · gpt-4o",
    color: "purple",
    icon:  <Brain className="w-4 h-4" />,
    desc:  "Query planner → tool selection → ReAct loop → faithfulness check → synthesis",
  },
  {
    id:    "mcp",
    label: "Python MCP Server",
    sub:   "FastAPI · Railway",
    color: "gold",
    icon:  <Server className="w-4 h-4" />,
    desc:  "5 tools · Pydantic on every I/O · HMAC auth · DLQ · Langfuse tracing",
  },
  {
    id:    "rag",
    label: "RAG Pipeline",
    sub:   "BM25 + FTS5 + Cross-Encoder",
    color: "green",
    icon:  <Database className="w-4 h-4" />,
    desc:  "SQLite FTS5 full-text · rank_bm25 in-memory · MS-MARCO reranker · zero vector DB",
  },
  {
    id:    "security",
    label: "Security Layer",
    sub:   "HMAC · Rate limit · Scrub",
    color: "red",
    icon:  <Shield className="w-4 h-4" />,
    desc:  "Request signing · 30s replay window · PII scrubbing · Upstash rate limits",
  },
]

const ANTI_HALLUCINATION = [
  { n: "01", label: "Zod / Pydantic schema",   detail: "Every tool I/O constrained to strict types. Impossible to produce malformed output.",        metric: "type-safe" },
  { n: "02", label: "RAG grounding",           detail: "Answer generated strictly from retrieved chunks. Parametric memory blocked by system prompt.", metric: "context-only" },
  { n: "03", label: "Cross-encoder rerank",    detail: "Top-12 BM25 candidates reranked to top-4 by MS-MARCO cross-encoder. Semantic filter.",       metric: "12→4" },
  { n: "04", label: "Faithfulness score",      detail: "NLI-style check: does every claim exist in retrieved context? Threshold: 0.75.",              metric: ">0.75 required" },
  { n: "05", label: "Confidence gate",         detail: "Low confidence → abstain + flag. Never hallucinate a confident wrong answer.",                metric: "abstain < 0.70" },
  { n: "06", label: "DLQ sentinel",            detail: "Every failed tool call → dead letter queue with full context. Zero silent failures.",         metric: "zero silent" },
]

const DECISIONS = [
  {
    title: "Why Python for the MCP server?",
    reason: "FastAPI + Pydantic is the same stack running at Lawline and Resso. Zero context switching. sentence-transformers and rank_bm25 are Python-native. The entire RAG pipeline is one import away.",
    alt:   "Node.js MCP server",
    altWhy: "No Pydantic equivalent. Cross-encoder reranker would need a separate Python sidecar anyway.",
  },
  {
    title: "Why no vector database?",
    reason: "SQLite FTS5 handles stemmed full-text search. rank_bm25 handles BM25 scoring in memory. Cross-encoder does semantic matching at rerank. Three free libraries replace a $70/month vector DB with equal or better accuracy.",
    alt:   "Pinecone / Qdrant",
    altWhy: "Paid service, external dependency, round-trip latency, not needed for the corpus size.",
  },
  {
    title: "Why contextual retrieval over standard chunking?",
    reason: "Every chunk has a 2-sentence GPT-4o-generated context prepended during indexing. 'Revenue increased 9%' becomes 'From AMEX 2024 10-K, MD&A section, Q3 revenue performance: Revenue increased 9%'. Retrieval failure drops ~49% (Anthropic contextual retrieval benchmark).",
    alt:   "Standard chunking",
    altWhy: "Chunks lose surrounding document context. Wrong sections retrieved for ambiguous queries.",
  },
  {
    title: "Why HMAC request signing?",
    reason: "Two services talking over the public internet. Bearer tokens can be stolen and replayed. HMAC-SHA256 with a 30-second timestamp window means a captured request is useless after 30 seconds — and the signature proves it came from the correct client.",
    alt:   "JWT / API key only",
    altWhy: "No replay protection. Stolen key = full access. HMAC adds integrity + authenticity + freshness.",
  },
]

const SKILLS_MAP = [
  { skill: "Agentic RAG",         where: "Core system", level: 100 },
  { skill: "MCP Protocol",        where: "Tool layer",  level: 100 },
  { skill: "Anti-hallucination",  where: "6 layers",    level: 100 },
  { skill: "Python / FastAPI",    where: "MCP server",  level: 100 },
  { skill: "TypeScript / Next.js",where: "Frontend",    level: 100 },
  { skill: "Production security", where: "HMAC + DLQ",  level: 100 },
  { skill: "Eval-gated CI/CD",    where: "GitHub Actions",level: 100 },
  { skill: "Observability",       where: "Langfuse",    level: 100 },
]

// ─── Components ───────────────────────────────────────────────────────────────

const COLOR_MAP = {
  blue:   { text: "text-accent-blue",   bg: "bg-accent-blue/8",   border: "border-accent-blue/15"   },
  purple: { text: "text-violet-500",    bg: "bg-violet-50",       border: "border-violet-200"        },
  gold:   { text: "text-amber-500",     bg: "bg-amber-50",        border: "border-amber-200"         },
  green:  { text: "text-emerald-500",   bg: "bg-emerald-50",      border: "border-emerald-200"       },
  red:    { text: "text-red-500",       bg: "bg-red-50",          border: "border-red-200"           },
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArchitecturePage() {
  const [activeLayer, setActiveLayer] = useState<string | null>(null)
  const [activeDecision, setActiveDecision] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-surface pt-14">
      {/* Background grid */}
      <div className="fixed inset-0 bg-grid-subtle bg-grid-subtle opacity-40 pointer-events-none" />

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
            Agentic RAG system over AMEX public financial documents.
            Every architectural decision documented. Every skill demonstrated in production.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            {[
              { label: "8 / 8 JD requirements", color: "blue" },
              { label: "6-layer anti-hallucination", color: "blue" },
              { label: "MCP protocol", color: "blue" },
              { label: "zero vector DB", color: "blue" },
              { label: "eval-gated CI/CD", color: "blue" },
            ].map(b => (
              <span
                key={b.label}
                className={clsx(
                  "text-xs font-mono px-3 py-1 rounded-full border",
                  (COLOR_MAP as any)[b.color].text,
                  (COLOR_MAP as any)[b.color].bg,
                  (COLOR_MAP as any)[b.color].border
                )}
              >
                {b.label}
              </span>
            ))}
          </div>
        </div>

        {/* ── System Architecture Diagram ───────────────────────────── */}
        <Section id="system" label="System Architecture">
          <div className="space-y-3">
            {LAYERS.map((layer, i) => {
              const c = COLOR_MAP[layer.color as keyof typeof COLOR_MAP]
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
                        <span className="font-heading font-semibold text-sm text-ink">
                          {layer.label}
                        </span>
                        <span className={clsx("text-[10px] font-mono px-2 py-0.5 rounded-full border", c.text, c.bg, c.border)}>
                          {layer.sub}
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted font-mono">{layer.desc}</p>
                    </div>
                    <span className={clsx("text-xs font-mono", c.text, !active && "opacity-0")}>
                      ▲
                    </span>
                  </button>

                  {active && (
                    <div className={clsx(
                      "mt-1 p-4 rounded-xl border text-sm font-mono text-ink-muted leading-relaxed",
                      c.bg, c.border
                    )}>
                      {layer.id === "frontend" && (
                        <ExpandFrontend />
                      )}
                      {layer.id === "agent" && <ExpandAgent />}
                      {layer.id === "mcp"    && <ExpandMcp />}
                      {layer.id === "rag"    && <ExpandRag />}
                      {layer.id === "security" && <ExpandSecurity />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Section>

        {/* ── Anti-Hallucination ──────────────────────────────────────── */}
        <Section id="anti-hallucination" label="Anti-Hallucination Architecture">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ANTI_HALLUCINATION.map(layer => (
              <div
                key={layer.n}
                className="p-4 rounded-xl border border-border bg-surface-1
                           hover:bg-surface-2 hover:border-border-strong transition-all"
              >
                <div className="flex items-start gap-3">
                  <span className="text-[10px] font-mono text-ink-faint font-bold mt-0.5 flex-shrink-0">
                    {layer.n}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-accent-green flex-shrink-0" />
                      <span className="text-sm font-heading font-semibold text-ink">
                        {layer.label}
                      </span>
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
              layered architectural constraints — not prompting tricks. Same defense system running
              at Lawline.tech in production, now applied to financial document intelligence.
            </p>
          </div>
        </Section>

        {/* ── Architecture Decisions ──────────────────────────────────── */}
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
                    <span className="text-sm font-heading font-semibold text-ink">
                      {d.title}
                    </span>
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
                        <div className="text-[10px] font-mono text-accent-green/70 mb-1 uppercase">
                          Decision
                        </div>
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

        {/* ── JD Match ────────────────────────────────────────────────── */}
        <Section id="jd-match" label="JD Match · 8 of 8">
          <div className="space-y-2">
            {JD_MATCHES.map((m, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-border
                           bg-surface-1 hover:bg-surface-2 transition-all"
              >
                <CheckCircle className="w-4 h-4 text-accent-green flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-heading font-semibold text-ink mb-0.5">
                    {m.req}
                  </div>
                  <div className="text-[11px] font-mono text-ink-muted truncate">{m.proof}</div>
                </div>
                <span className="text-[10px] font-mono text-accent-blue/70 px-2 py-0.5
                                 rounded-full border border-accent-blue/15 bg-accent-blue/5
                                 flex-shrink-0">
                  {m.metric}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4">
            {[
              { n: "8 / 8", label: "JD requirements",   color: "blue" },
              { n: "3.8%",  label: "Hallucination rate", color: "blue" },
              { n: "$0.50", label: "Total infra cost",   color: "blue" },
            ].map(s => (
              <div
                key={s.n}
                className={clsx(
                  "p-4 rounded-xl border text-center",
                  (COLOR_MAP as any)[s.color].bg,
                  (COLOR_MAP as any)[s.color].border
                )}
              >
                <div className={clsx(
                  "font-heading font-bold text-2xl mb-1",
                  (COLOR_MAP as any)[s.color].text
                )}>
                  {s.n}
                </div>
                <div className="text-xs font-mono text-ink-muted">{s.label}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Skills Map ──────────────────────────────────────────────── */}
        <Section id="skills" label="Skills Demonstrated">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SKILLS_MAP.map(s => (
              <div
                key={s.skill}
                className="p-3.5 rounded-xl border border-border bg-surface-1
                           hover:bg-surface-2 transition-all"
              >
                <div className="text-xs font-heading font-semibold text-ink mb-1">
                  {s.skill}
                </div>
                <div className="text-[10px] font-mono text-ink-faint mb-2.5">{s.where}</div>
                <div className="h-1 rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent-blue to-purple-500"
                    style={{ width: `${s.level}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Builder card ────────────────────────────────────────────── */}
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
              Lawline.tech · Resso.ai · TTC Capstone
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <a
                href="mailto:tosolankiom@gmail.com"
                className="flex items-center gap-2 px-4 py-2 rounded-xl
                           bg-accent-blue text-white text-sm font-medium
                           hover:bg-blue-500 transition-colors shadow-glow-blue"
              >
                Contact
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href="https://www.omkumarsolanki.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border
                           text-ink-muted text-sm font-medium hover:bg-surface-2 transition-colors"
              >
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
      <p className="text-ink-muted">• <strong className="text-ink">Streaming SSE</strong> — Vercel AI SDK + custom event parser. Text delta, step events, MCP logs all multiplexed on one stream.</p>
      <p className="text-ink-muted">• <strong className="text-ink">Agent Trace Panel</strong> — Every planning step, tool call, and faithfulness check shown live with latency.</p>
      <p className="text-ink-muted">• <strong className="text-ink">MCP Inspector</strong> — Raw JSON-RPC request/response log, like Chrome DevTools Network but for AI tool calls.</p>
      <p className="text-ink-muted">• <strong className="text-ink">Hallucination Defense</strong> — 6 layers shown in real-time. Each layer lights up green as it passes.</p>
    </div>
  )
}

function ExpandAgent() {
  return (
    <div className="space-y-2 text-xs">
      <p className="text-ink-muted">• <strong className="text-ink">ReAct loop</strong> — Reason → Act (tool call) → Observe (result) → Reason again. Continues until answer is grounded.</p>
      <p className="text-ink-muted">• <strong className="text-ink">Query planner</strong> — Decomposes complex queries into sub-questions, decides which tools to call and in what order.</p>
      <p className="text-ink-muted">• <strong className="text-ink">Self-reflection</strong> — After initial retrieval, agent evaluates if enough context exists before synthesizing.</p>
      <p className="text-ink-muted">• <strong className="text-ink">Structured output</strong> — Final response always Zod-validated before streaming to client.</p>
    </div>
  )
}

function ExpandMcp() {
  return (
    <div className="space-y-2 text-xs">
      <p className="text-ink-muted">• <strong className="text-ink">FastMCP framework</strong> — Python MCP server with @mcp.tool() decorators. Pydantic schema on every tool.</p>
      <p className="text-ink-muted">• <strong className="text-ink">5 tools</strong> — search_financial_docs · get_document_page · compare_benchmarks · validate_faithfulness · extract_kpis</p>
      <p className="text-ink-muted">• <strong className="text-ink">HMAC auth</strong> — Every request signed. 30-second replay window. TrustedHost middleware. CORS locked.</p>
      <p className="text-ink-muted">• <strong className="text-ink">DLQ</strong> — 3 retries with exponential backoff + jitter. Failed calls to Upstash Redis DLQ with full context.</p>
    </div>
  )
}

function ExpandRag() {
  return (
    <div className="space-y-2 text-xs">
      <p className="text-ink-muted">• <strong className="text-ink">SQLite FTS5</strong> — Porter stemming. "revenues" matches "revenue". Boolean queries. No external DB.</p>
      <p className="text-ink-muted">• <strong className="text-ink">rank_bm25</strong> — BM25Okapi in-memory index. Fast candidate generation. Rebuilt on new document ingestion.</p>
      <p className="text-ink-muted">• <strong className="text-ink">Cross-encoder reranker</strong> — MS-MARCO MiniLM. Top-12 BM25 candidates → top-4 by semantic score. This IS the semantic layer.</p>
      <p className="text-ink-muted">• <strong className="text-ink">Contextual indexing</strong> — 2-sentence GPT-4o context prepended to every chunk at index time. ~49% fewer retrieval failures.</p>
    </div>
  )
}

function ExpandSecurity() {
  return (
    <div className="space-y-2 text-xs">
      <p className="text-ink-muted">• <strong className="text-ink">HMAC-SHA256</strong> — Body signed with shared secret + timestamp. Proves origin + integrity + freshness.</p>
      <p className="text-ink-muted">• <strong className="text-ink">Replay protection</strong> — 30-second timestamp window. Captured requests expire and become useless.</p>
      <p className="text-ink-muted">• <strong className="text-ink">PII scrubbing</strong> — Card numbers, SSNs, API keys regex-scrubbed before any logging or tracing.</p>
      <p className="text-ink-muted">• <strong className="text-ink">Rate limiting</strong> — Upstash Redis sliding window. 20 req/60s. Prevents abuse and cost spikes.</p>
    </div>
  )
}
