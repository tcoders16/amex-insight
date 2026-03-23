"use client"

import { CitationCard } from "@/components/rag/CitationCard"
import { ThinkingIndicator } from "./ThinkingIndicator"
import { clsx } from "clsx"
import type { ChatMessage, GeneratedDoc } from "@/lib/types"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

function DocDownloadButton({ doc }: { doc: GeneratedDoc }) {
  const isPpt  = doc.docType === "ppt"
  const ext    = isPpt ? "PPTX" : "DOCX"
  const icon   = isPpt ? "📊" : "📄"
  const color  = isPpt ? "border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700"
                       : "border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700"
  const badge  = isPpt ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"

  return (
    <a
      href={doc.url}
      download={doc.filename}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        "inline-flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border",
        "text-[13px] font-medium transition-all duration-150 no-underline",
        "shadow-sm hover:shadow active:scale-[0.98]",
        color
      )}
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="truncate max-w-[220px]">{doc.filename}</span>
      <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded font-mono tracking-wide flex-shrink-0", badge)}>
        {ext}
      </span>
      <svg className="w-3.5 h-3.5 flex-shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 4v11" />
      </svg>
    </a>
  )
}

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user"

  if (isUser) {
    return (
      <div className="flex justify-end animate-slide-up">
        <div className="max-w-[78%] px-4 py-3 rounded-2xl rounded-tr-md
                        bg-accent-blue text-white text-[14px] leading-relaxed font-medium
                        shadow-card">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 animate-slide-up">
      <div className="flex items-start gap-3">

        {/* Avatar */}
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-accent-blue
                        flex items-center justify-center shadow-card mt-0.5">
          <span className="text-white font-mono font-black text-[11px] tracking-widest">AI</span>
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          {message.streaming && !message.content ? (
            <ThinkingIndicator />
          ) : (
            <div className={clsx(
              "text-[14px] text-ink-secondary leading-[1.75] font-normal prose prose-sm max-w-none",
              "prose-headings:font-semibold prose-headings:text-ink-primary",
              "prose-strong:font-semibold prose-strong:text-ink-primary",
              "prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1",
              "prose-p:my-1.5 prose-p:leading-[1.75]",
              "prose-code:text-[12px] prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded",
              message.streaming && "stream-text"
            )}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
              {message.streaming && (
                <span className="inline-block w-0.5 h-[1.1em] bg-accent-blue ml-0.5 cursor-blink align-text-bottom" />
              )}
            </div>
          )}

          {message.citations && message.citations.length > 0 && (
            <div className="mt-4">
              <CitationCard citations={message.citations} />
            </div>
          )}

          {message.generatedDocs && message.generatedDocs.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">Generated Documents</p>
              {message.generatedDocs.map((doc, i) => (
                <DocDownloadButton key={i} doc={doc} />
              ))}
            </div>
          )}

          {message.confidence != null && message.confidence < 0.70 && (
            <div className="mt-3 flex items-start gap-2.5 px-3.5 py-3 rounded-xl
                            border border-accent-red/20 bg-accent-red/5">
              <span className="text-accent-red text-base leading-none mt-0.5">⚠</span>
              <p className="text-[13px] text-accent-red font-medium leading-snug">
                Low confidence ({(message.confidence * 100).toFixed(0)}%) —
                review source documents directly.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
