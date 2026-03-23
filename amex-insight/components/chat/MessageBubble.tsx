"use client"

import { CitationCard } from "@/components/rag/CitationCard"
import { ThinkingIndicator } from "./ThinkingIndicator"
import { clsx } from "clsx"
import type { ChatMessage } from "@/lib/types"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

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
