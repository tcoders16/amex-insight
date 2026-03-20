"use client"

import { FileText, ExternalLink, BookOpen } from "lucide-react"
import { clsx } from "clsx"
import { getDocMeta } from "@/lib/doc-registry"
import type { Citation } from "@/lib/types"

interface CitationCardProps {
  citations: Citation[]
}

export function CitationCard({ citations }: CitationCardProps) {
  if (!citations.length) return null

  // Group citations by doc so each document appears as one card
  const grouped = citations.reduce<Record<string, Citation[]>>((acc, c) => {
    const key = c.doc
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  const docIds = Object.keys(grouped)

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface-2 overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border bg-surface-1">
        <FileText className="w-3.5 h-3.5 text-accent-blue flex-shrink-0" />
        <span className="text-[11px] font-mono font-semibold text-ink-muted uppercase tracking-wider">
          Sources · {docIds.length} document{docIds.length > 1 ? "s" : ""} · {citations.length} page{citations.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Document rows */}
      <div className="divide-y divide-border">
        {docIds.map(docId => {
          const meta   = getDocMeta(docId)
          const pages  = grouped[docId]
          const topScore = Math.max(...pages.map(p => p.score ?? 0))

          return (
            <div key={docId} className="px-3.5 py-3 hover:bg-surface-1 transition-colors group">

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

                {/* Overall relevance score */}
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

              {/* Page chips */}
              <div className="flex flex-wrap gap-1.5 ml-9">
                {pages.map((p, i) => (
                  <a
                    key={i}
                    href={meta.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={clsx(
                      "flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-mono",
                      "bg-surface-1 border-border text-ink-muted",
                      "hover:border-accent-blue/30 hover:bg-accent-blue/5 hover:text-accent-blue",
                      "transition-colors cursor-pointer"
                    )}
                  >
                    <span className="text-ink-faint">p.</span>
                    <span className="font-semibold text-ink">{p.page}</span>
                    {p.section && (
                      <>
                        <span className="text-ink-faint">·</span>
                        <span className="max-w-[140px] truncate text-ink-muted">{p.section}</span>
                      </>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-surface-1 border-t border-border">
        <span className="text-[10px] font-mono text-ink-faint">
          Retrieved via BM25 + FTS5 + Cross-Encoder reranking
        </span>
        <a
          href="https://ir.americanexpress.com/sec-filings/annual-reports"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] font-mono text-accent-blue
                     hover:underline transition-colors"
        >
          <ExternalLink className="w-2.5 h-2.5" />
          AMEX Investor Relations
        </a>
      </div>
    </div>
  )
}
