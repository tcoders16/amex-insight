"use client"

import { useState } from "react"
import { FileText, ExternalLink, BookOpen, ChevronDown, ChevronRight, Quote } from "lucide-react"
import { clsx } from "clsx"
import { getDocMeta } from "@/lib/doc-registry"
import type { Citation } from "@/lib/types"

// Highlight financial figures and key terms in retrieved text
function HighlightedText({ text }: { text: string }) {
  const pattern = /(\$[\d.,]+\s*(?:billion|trillion|million|B|T|M)?|[\d.]+\s*(?:percent|%)|[\d.,]+\s*(?:billion|trillion|million)|EPS|CAGR|revenue|spending|growth|net income|card member|billed business)/gi

  const parts: Array<{ text: string; highlight: boolean }> = []
  let last = 0
  let match: RegExpExecArray | null

  const re = new RegExp(pattern.source, "gi")
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index), highlight: false })
    parts.push({ text: match[0], highlight: true })
    last = re.lastIndex
  }
  if (last < text.length) parts.push({ text: text.slice(last), highlight: false })

  return (
    <span>
      {parts.map((p, i) =>
        p.highlight ? (
          <mark key={i} className="bg-accent-blue/15 text-accent-blue rounded px-0.5 font-semibold not-italic">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </span>
  )
}

interface CitationCardProps {
  citations: Citation[]
}

export function CitationCard({ citations }: CitationCardProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  if (!citations.length) return null

  // Group citations by doc
  const grouped = citations.reduce<Record<string, Citation[]>>((acc, c) => {
    if (!acc[c.doc]) acc[c.doc] = []
    acc[c.doc].push(c)
    return acc
  }, {})

  const docIds = Object.keys(grouped)

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface-2 overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border bg-surface-1">
        <FileText className="w-3.5 h-3.5 text-accent-blue flex-shrink-0" />
        <span className="text-[11px] font-mono font-semibold text-ink-muted uppercase tracking-wider">
          Sources · {docIds.length} document{docIds.length > 1 ? "s" : ""} · {citations.length} passage{citations.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Document rows */}
      <div className="divide-y divide-border">
        {docIds.map(docId => {
          const meta     = getDocMeta(docId)
          const pages    = grouped[docId]
          const topScore = Math.max(...pages.map(p => p.score ?? 0))

          return (
            <div key={docId} className="px-3.5 py-3 hover:bg-surface-1 transition-colors">

              {/* Document title row */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-accent-blue/8 border border-accent-blue/15
                                  flex items-center justify-center flex-shrink-0 mt-0.5">
                    <BookOpen className="w-3.5 h-3.5 text-accent-blue" />
                  </div>
                  <div className="min-w-0">
                    <a
                      href={meta.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 group/link"
                    >
                      <span className="text-[13px] font-semibold text-ink font-heading
                                       group-hover/link:text-accent-blue transition-colors leading-snug">
                        {meta.title}
                      </span>
                      <ExternalLink className="w-3 h-3 text-ink-faint group-hover/link:text-accent-blue
                                               transition-colors flex-shrink-0" />
                    </a>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono text-accent-blue bg-accent-blue/8
                                       px-1.5 py-0.5 rounded border border-accent-blue/15">
                        {meta.badge}
                      </span>
                      <span className="text-[10px] font-mono text-ink-faint">
                        SEC EDGAR · AXP · CIK 0000004962
                      </span>
                    </div>
                  </div>
                </div>

                {topScore > 0 && (
                  <span className={clsx(
                    "text-[11px] font-mono font-bold px-2 py-1 rounded-lg flex-shrink-0",
                    topScore >= 0.6
                      ? "text-accent-blue bg-accent-blue/10 border border-accent-blue/15"
                      : "text-ink-faint bg-surface-3 border border-border"
                  )}>
                    {(topScore * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              {/* Page chips + expandable source text */}
              <div className="flex flex-wrap gap-1.5 ml-9">
                {pages.map((p, i) => {
                  const chipKey = `${docId}-${p.page}-${i}`
                  const isOpen  = expandedKey === chipKey

                  return (
                    <div key={i} className="flex flex-col w-full max-w-full">
                      <button
                        onClick={() => setExpandedKey(isOpen ? null : chipKey)}
                        className={clsx(
                          "flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-mono w-fit",
                          "transition-colors cursor-pointer",
                          isOpen
                            ? "border-accent-blue/40 bg-accent-blue/8 text-accent-blue"
                            : "bg-surface-1 border-border text-ink-muted hover:border-accent-blue/30 hover:bg-accent-blue/5 hover:text-accent-blue"
                        )}
                      >
                        {isOpen
                          ? <ChevronDown className="w-3 h-3 flex-shrink-0" />
                          : <ChevronRight className="w-3 h-3 flex-shrink-0" />
                        }
                        <span className="text-ink-faint">p.</span>
                        <span className="font-semibold text-ink">{p.page}</span>
                        {p.section && (
                          <>
                            <span className="text-ink-faint">·</span>
                            <span className="max-w-[140px] truncate text-ink-muted">{p.section}</span>
                          </>
                        )}
                        {p.score > 0 && (
                          <>
                            <span className="text-ink-faint">·</span>
                            <span className="text-accent-blue font-bold">{(p.score * 100).toFixed(0)}%</span>
                          </>
                        )}
                      </button>

                      {/* Expanded source passage */}
                      {isOpen && (
                        <div className="mt-2 mb-1 ml-1 rounded-xl border border-accent-blue/20
                                        bg-accent-blue/4 overflow-hidden">

                          {/* Passage header */}
                          <div className="flex items-center justify-between px-3 py-2
                                          border-b border-accent-blue/15 bg-accent-blue/6">
                            <div className="flex items-center gap-2">
                              <Quote className="w-3 h-3 text-accent-blue flex-shrink-0" />
                              <span className="text-[10px] font-mono font-semibold text-accent-blue uppercase tracking-wider">
                                {meta.title} · Page {p.page}
                                {p.section ? ` · ${p.section}` : ""}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-ink-faint">
                                relevance {(p.score * 100).toFixed(0)}%
                              </span>
                              <span className="text-[9px] font-mono text-ink-faint bg-surface-2
                                               px-1.5 py-0.5 rounded border border-border">
                                BM25 + cross-encoder
                              </span>
                            </div>
                          </div>

                          {/* Passage body */}
                          <div className="px-3.5 py-3">
                            {p.text ? (
                              <p className="text-[12.5px] leading-[1.8] text-ink-secondary font-normal italic">
                                <HighlightedText text={p.text} />
                              </p>
                            ) : (
                              <p className="text-[12px] text-ink-faint italic">
                                Full text available — open document at SEC EDGAR to view this page.
                              </p>
                            )}
                          </div>

                          {/* Passage footer */}
                          <div className="flex items-center justify-between px-3 py-1.5
                                          border-t border-accent-blue/10 bg-surface-1/60">
                            <span className="text-[10px] font-mono text-ink-faint">
                              doc_id: {p.doc} · page_num: {p.page}
                            </span>
                            <a
                              href={meta.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] font-mono text-accent-blue hover:underline"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              View in SEC EDGAR
                            </a>
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

      {/* Footer */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-surface-1 border-t border-border">
        <span className="text-[10px] font-mono text-ink-faint">
          Retrieved via BM25 + FTS5 + Cross-Encoder reranking · click any page to view passage
        </span>
        <a
          href="https://ir.americanexpress.com/sec-filings/annual-reports"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] font-mono text-accent-blue hover:underline"
        >
          <ExternalLink className="w-2.5 h-2.5" />
          AMEX Investor Relations
        </a>
      </div>
    </div>
  )
}
