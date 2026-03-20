"use client"

import { Brain } from "lucide-react"

interface ThinkingIndicatorProps {
  label?: string
}

export function ThinkingIndicator({ label = "Agent reasoning..." }: ThinkingIndicatorProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl
                    bg-surface-2 border border-border w-fit">
      <div className="relative w-5 h-5">
        <Brain className="w-5 h-5 text-accent-blue opacity-80" />
        <span className="absolute inset-0 rounded-full bg-accent-blue/20 animate-ping" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-ink-muted">{label}</span>
        <span className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-blue thinking-dot-1" />
          <span className="w-1.5 h-1.5 rounded-full bg-accent-blue thinking-dot-2" />
          <span className="w-1.5 h-1.5 rounded-full bg-accent-blue thinking-dot-3" />
        </span>
      </div>
    </div>
  )
}
