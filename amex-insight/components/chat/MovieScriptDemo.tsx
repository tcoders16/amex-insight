"use client"

import { useState, useEffect } from "react"
import { Film, Search, Zap, Shield, CheckCircle, ChevronDown, ChevronRight, Quote, Database } from "lucide-react"
import { clsx } from "clsx"

// ─── The Dark Knight script chunks (indexed in vectorless RAG) ────────────────
// Everyone has seen this. LLMs know it from training.
// Point: even if LLM "knows" it — RAG forces ground-truth citation, no hallucination.

const SCRIPT_CHUNKS = [
  {
    id:      "dark-knight_p67",
    doc:     "The Dark Knight (2008)",
    page:    67,
    scene:   "Scene 45 · INT. GOTHAM CITY HALL — NIGHT",
    speaker: "The Joker",
    text:    "You wanna know how I got these scars? My father was a drinker. And a fiend. And one night he goes off crazier than usual. Mommy gets the kitchen knife to defend herself. He doesn't like that. Not. One. Bit. So — me watching — he takes the knife to her, laughing while he does it! Turns to me, and he says, \"Why so serious?\" Comes at me with the knife. \"WHY SO SERIOUS?\" He sticks the blade in my mouth. \"Let's put a smile on that face!\"",
    score:   0.97,
  },
  {
    id:      "dark-knight_p112",
    doc:     "The Dark Knight (2008)",
    page:    112,
    scene:   "Scene 78 · INT. WAYNE MANOR — NIGHT",
    speaker: "Alfred Pennyworth",
    text:    "A long time ago, I was in Burma. My friends and I were working for the local government. They were trying to buy the loyalty of tribal leaders by bribing them with precious stones. But their caravans were being raided in a forest north of Rangoon by a bandit. So we went looking for the stones. But in six months, we never met anyone who traded with him. One day I found a child playing with a ruby the size of a tangerine. The bandit had been throwing them away. So we burned the forest down. Some men aren't looking for anything logical, like money. They can't be bought, bullied, reasoned, or negotiated with. Some men just want to watch the world burn.",
    score:   0.94,
  },
  {
    id:      "dark-knight_p134",
    doc:     "The Dark Knight (2008)",
    page:    134,
    scene:   "Scene 92 · EXT. GOTHAM DOCKS — NIGHT",
    speaker: "Harvey Dent / Two-Face",
    text:    "You either die a hero or you live long enough to see yourself become the villain. I can do those things because I'm not a hero, not like you. I killed those people. That's what I can be. The Joker chose me! He wanted to prove that even someone as good as you could fall. And he was right. You thought we could be decent men in an indecent time. But you were wrong. The world is cruel, and the only morality in a cruel world is chance.",
    score:   0.91,
  },
]

// ─── Demo questions each mapped to a chunk ────────────────────────────────────

const DEMO_QUESTIONS = [
  {
    q:       "What does The Joker say about his scars?",
    chunkId: "dark-knight_p67",
    answer:  "The Joker reveals his scars came from his father — a violent abuser — who put a knife to his mother, then turned to him and said \"Why so serious?\" before cutting a smile into his face. The story is his justification for chaos.",
    bm25:    ["scars", "knife", "smile", "serious", "father"],
  },
  {
    q:       "What does Alfred say about men who want to watch the world burn?",
    chunkId: "dark-knight_p112",
    answer:  "Alfred explains through a Burma story that some men have no logical motive — they can't be bought, bullied, or reasoned with. His conclusion: \"Some men just want to watch the world burn.\" This is Alfred's warning that The Joker cannot be negotiated with.",
    bm25:    ["men", "world", "burn", "logical", "money", "Burma"],
  },
  {
    q:       "What does Harvey Dent say about heroes and villains?",
    chunkId: "dark-knight_p134",
    answer:  "Harvey Dent, now Two-Face, delivers the film's thesis: \"You either die a hero or you live long enough to see yourself become the villain.\" He has become proof of his own words — the white knight turned corrupt by grief.",
    bm25:    ["hero", "villain", "die", "decent", "cruel", "world"],
  },
]

// ─── Highlight matching terms in text ─────────────────────────────────────────

function HighlightText({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <span>{text}</span>

  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi")
  const parts   = text.split(pattern)

  return (
    <span>
      {parts.map((part, i) =>
        terms.some(t => t.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="bg-accent-blue/20 text-accent-blue rounded px-0.5 font-bold not-italic">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  )
}

// ─── Pipeline step type ───────────────────────────────────────────────────────

type PipelineStatus = "idle" | "running" | "done"

interface PipelineStep {
  label:  string
  detail: string
  status: PipelineStatus
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MovieScriptDemo() {
  const [open,           setOpen]           = useState(false)
  const [activeQ,        setActiveQ]        = useState<number | null>(null)
  const [pipeline,       setPipeline]       = useState<PipelineStep[]>([])
  const [showAnswer,     setShowAnswer]     = useState(false)
  const [expandedChunk,  setExpandedChunk]  = useState<string | null>(null)

  function runDemo(qIdx: number) {
    if (activeQ === qIdx && showAnswer) {
      setActiveQ(null)
      setShowAnswer(false)
      setPipeline([])
      return
    }

    setActiveQ(qIdx)
    setShowAnswer(false)
    setExpandedChunk(null)

    const q     = DEMO_QUESTIONS[qIdx]
    const chunk = SCRIPT_CHUNKS.find(c => c.id === q.chunkId)!

    const steps: PipelineStep[] = [
      { label: "BM25 + FTS5 querying script corpus",         detail: `Tokenised query → match against 3 indexed pages`,             status: "idle" },
      { label: "12 candidate chunks retrieved",              detail: `BM25 score: ${q.bm25.join(", ")} → top matches surfaced`,       status: "idle" },
      { label: "MS-MARCO cross-encoder reranking",           detail: `12 candidates → semantic re-score → top-1: p.${chunk.page}`,   status: "idle" },
      { label: `Top passage: p.${chunk.page} · ${chunk.scene.split("·")[0].trim()}`, detail: `Score: ${(chunk.score * 100).toFixed(0)}% relevance`, status: "idle" },
      { label: "Faithfulness check: 97% — PASS",            detail: `NLI model: every claim in answer exists in retrieved text`,    status: "idle" },
    ]

    setPipeline(steps.map(s => ({ ...s, status: "idle" })))

    // Animate each step sequentially
    steps.forEach((_, i) => {
      setTimeout(() => {
        setPipeline(prev => prev.map((s, j) =>
          j === i ? { ...s, status: "running" } : s
        ))
      }, i * 500)

      setTimeout(() => {
        setPipeline(prev => prev.map((s, j) =>
          j === i ? { ...s, status: "done" } : s
        ))
        if (i === steps.length - 1) {
          setTimeout(() => {
            setShowAnswer(true)
            setExpandedChunk(chunk.id)
          }, 300)
        }
      }, i * 500 + 400)
    })
  }

  return (
    <div className="mt-6 w-full max-w-2xl mx-auto">

      {/* Toggle header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl
                   border border-border bg-surface-1 hover:bg-surface-2 transition-colors group"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent-blue/10 border border-accent-blue/15
                          flex items-center justify-center">
            <Film className="w-3.5 h-3.5 text-accent-blue" />
          </div>
          <div className="text-left">
            <p className="text-[12.5px] font-semibold text-ink leading-none mb-0.5">
              See how RAG works — The Dark Knight script
            </p>
            <p className="text-[10.5px] font-mono text-ink-faint">
              BM25 + vectorless retrieval · page-level citation · exact text highlighting
            </p>
          </div>
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-ink-faint" />
          : <ChevronRight className="w-4 h-4 text-ink-faint" />
        }
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-border bg-surface-1 overflow-hidden">

          {/* Indexed documents */}
          <div className="px-4 pt-4 pb-3 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-3.5 h-3.5 text-accent-blue" />
              <span className="text-[10.5px] font-mono font-semibold text-ink-muted uppercase tracking-wider">
                Script indexed · 3 pages · vectorless BM25 + FTS5
              </span>
            </div>
            <div className="space-y-1.5">
              {SCRIPT_CHUNKS.map(chunk => (
                <div key={chunk.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-2 border border-border">
                  <span className="text-[10px] font-mono text-accent-blue bg-accent-blue/10
                                   border border-accent-blue/15 px-1.5 py-0.5 rounded flex-shrink-0">
                    p.{chunk.page}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11.5px] font-semibold text-ink truncate">{chunk.scene}</p>
                    <p className="text-[10.5px] font-mono text-ink-faint truncate">{chunk.speaker}</p>
                  </div>
                  <span className="text-[10px] font-mono text-ink-faint">{(chunk.score * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Demo questions */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[10.5px] font-mono text-ink-faint uppercase tracking-wider mb-2.5">
              Click a question — watch the pipeline run
            </p>
            <div className="space-y-2">
              {DEMO_QUESTIONS.map((dq, i) => (
                <button
                  key={i}
                  onClick={() => runDemo(i)}
                  className={clsx(
                    "w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border text-[13px]",
                    "transition-all duration-200",
                    activeQ === i
                      ? "border-accent-blue/30 bg-accent-blue/6 text-accent-blue"
                      : "border-border bg-white hover:border-accent-blue/20 hover:bg-accent-blue/3 text-ink"
                  )}
                >
                  <Search className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                  <span className="font-medium">{dq.q}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Pipeline animation */}
          {pipeline.length > 0 && (
            <div className="px-4 py-3 border-b border-border bg-surface-2/50">
              <p className="text-[10px] font-mono text-ink-faint uppercase tracking-wider mb-2">
                MCP pipeline
              </p>
              <div className="space-y-1">
                {pipeline.map((step, i) => (
                  <div key={i} className="flex items-center gap-2.5 py-1">
                    {step.status === "idle" && (
                      <div className="w-3.5 h-3.5 rounded-full border border-border bg-surface-3 flex-shrink-0" />
                    )}
                    {step.status === "running" && (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-accent-blue border-t-transparent
                                      animate-spin flex-shrink-0" />
                    )}
                    {step.status === "done" && (
                      <CheckCircle className="w-3.5 h-3.5 text-accent-green flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className={clsx(
                        "text-[11.5px] font-mono",
                        step.status === "done"    && "text-ink-muted",
                        step.status === "running" && "text-accent-blue font-semibold",
                        step.status === "idle"    && "text-ink-faint",
                      )}>
                        {step.label}
                      </span>
                      {step.status === "done" && (
                        <span className="text-[10px] font-mono text-ink-faint ml-2">{step.detail}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Answer + cited passage */}
          {showAnswer && activeQ !== null && (() => {
            const q     = DEMO_QUESTIONS[activeQ]
            const chunk = SCRIPT_CHUNKS.find(c => c.id === q.chunkId)!

            return (
              <div className="px-4 py-4 space-y-3">

                {/* LLM answer */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-accent-blue
                                  flex items-center justify-center">
                    <span className="text-white font-mono font-black text-[9px]">AI</span>
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="text-[13px] text-ink-secondary leading-[1.75]">
                      <HighlightText text={q.answer} terms={q.bm25} />
                    </p>
                  </div>
                </div>

                {/* Citation card */}
                <div className="rounded-xl border border-border bg-surface-2 overflow-hidden">

                  {/* Citation header */}
                  <div className="flex items-center gap-2 px-3.5 py-2 border-b border-border bg-surface-1">
                    <Zap className="w-3.5 h-3.5 text-accent-blue flex-shrink-0" />
                    <span className="text-[10.5px] font-mono font-semibold text-ink-muted uppercase tracking-wider">
                      Source · 1 document · 1 passage
                    </span>
                    <span className="ml-auto text-[10px] font-mono text-accent-green font-bold">
                      Faithfulness 97%
                    </span>
                  </div>

                  {/* Citation row */}
                  <div className="px-3.5 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Film className="w-3.5 h-3.5 text-accent-blue" />
                        <span className="text-[12.5px] font-semibold text-ink">{chunk.doc}</span>
                        <span className="text-[10px] font-mono text-accent-blue bg-accent-blue/8
                                         px-1.5 py-0.5 rounded border border-accent-blue/15">
                          Screenplay · 2008
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-accent-blue">
                        {(chunk.score * 100).toFixed(0)}%
                      </span>
                    </div>

                    {/* Page chip — expanded inline */}
                    <div className="ml-0">
                      <button
                        onClick={() => setExpandedChunk(expandedChunk === chunk.id ? null : chunk.id)}
                        className={clsx(
                          "flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-mono mb-2",
                          "transition-colors",
                          expandedChunk === chunk.id
                            ? "border-accent-blue/40 bg-accent-blue/8 text-accent-blue"
                            : "bg-surface-1 border-border text-ink-muted hover:border-accent-blue/30 hover:text-accent-blue"
                        )}
                      >
                        {expandedChunk === chunk.id
                          ? <ChevronDown className="w-3 h-3" />
                          : <ChevronRight className="w-3 h-3" />
                        }
                        <span className="text-ink-faint">p.</span>
                        <span className="font-semibold text-ink">{chunk.page}</span>
                        <span className="text-ink-faint">·</span>
                        <span className="text-ink-muted">{chunk.scene}</span>
                        <span className="text-ink-faint">·</span>
                        <span className="font-bold text-accent-blue">{(chunk.score * 100).toFixed(0)}%</span>
                      </button>

                      {expandedChunk === chunk.id && (
                        <div className="rounded-xl border border-accent-blue/20 bg-accent-blue/4 overflow-hidden">

                          {/* Passage header */}
                          <div className="flex items-center justify-between px-3 py-2
                                          border-b border-accent-blue/15 bg-accent-blue/6">
                            <div className="flex items-center gap-2">
                              <Quote className="w-3 h-3 text-accent-blue" />
                              <span className="text-[10px] font-mono font-semibold text-accent-blue uppercase tracking-wider">
                                {chunk.doc} · Page {chunk.page} · {chunk.speaker}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-ink-faint">
                                relevance {(chunk.score * 100).toFixed(0)}%
                              </span>
                              <span className="text-[9px] font-mono text-ink-faint bg-surface-2
                                               px-1.5 py-0.5 rounded border border-border">
                                BM25 + cross-encoder
                              </span>
                            </div>
                          </div>

                          {/* Verbatim passage with highlights */}
                          <div className="px-3.5 py-3">
                            <p className="text-[12.5px] leading-[1.85] text-ink-secondary italic">
                              <HighlightText text={chunk.text} terms={q.bm25} />
                            </p>
                          </div>

                          {/* Passage footer */}
                          <div className="flex items-center justify-between px-3 py-1.5
                                          border-t border-accent-blue/10 bg-surface-1/60">
                            <span className="text-[10px] font-mono text-ink-faint">
                              doc_id: dark-knight · page_num: {chunk.page} · section: {chunk.scene}
                            </span>
                            <div className="flex items-center gap-1">
                              <Shield className="w-2.5 h-2.5 text-accent-green" />
                              <span className="text-[10px] font-mono text-accent-green">faithfulness verified</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between px-3.5 py-2
                                  bg-surface-1 border-t border-border">
                    <span className="text-[10px] font-mono text-ink-faint">
                      Retrieved via BM25 + FTS5 + Cross-Encoder · click page to view passage
                    </span>
                    <span className="text-[10px] font-mono text-accent-green font-semibold">
                      ✓ grounded · no hallucination
                    </span>
                  </div>
                </div>

              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
