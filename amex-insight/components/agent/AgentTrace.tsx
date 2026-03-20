"use client"

import { useState } from "react"
import { ChevronDown, Zap, Search, CheckCircle, AlertCircle, Brain, FileText, Shield } from "lucide-react"
import { clsx } from "clsx"
import type { AgentStep } from "@/lib/types"

const STEP_ICONS: Record<string, React.ReactNode> = {
  plan:          <Brain className="w-3.5 h-3.5" />,
  tool_call:     <Zap className="w-3.5 h-3.5" />,
  tool_result:   <CheckCircle className="w-3.5 h-3.5" />,
  reasoning:     <Brain className="w-3.5 h-3.5" />,
  faithfulness:  <Shield className="w-3.5 h-3.5" />,
  synthesis:     <FileText className="w-3.5 h-3.5" />,
  error:         <AlertCircle className="w-3.5 h-3.5" />,
}

const STEP_COLORS: Record<string, string> = {
  plan:          "text-accent-blue border-accent-blue/15 bg-accent-blue/5",
  tool_call:     "text-accent-blue border-accent-blue/15 bg-accent-blue/5",
  tool_result:   "text-accent-blue border-accent-blue/15 bg-accent-blue/5",
  reasoning:     "text-ink-muted border-border bg-surface-2",
  faithfulness:  "text-accent-blue border-accent-blue/15 bg-accent-blue/5",
  synthesis:     "text-accent-blue border-accent-blue/15 bg-accent-blue/5",
  error:         "text-accent-red border-accent-red/20 bg-accent-red/5",
}

function StepRow({ step }: { step: AgentStep }) {
  const [expanded, setExpanded] = useState(false)
  const color = STEP_COLORS[step.type] ?? STEP_COLORS.reasoning

  return (
    <div className="animate-slide-up">
      <button
        onClick={() => step.detail && setExpanded(!expanded)}
        className={clsx(
          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all",
          color,
          step.detail && "cursor-pointer hover:brightness-110",
          !step.detail && "cursor-default"
        )}
      >
        <span className="flex-shrink-0 opacity-80">
          {STEP_ICONS[step.type] ?? <Search className="w-3.5 h-3.5" />}
        </span>
        <span className="flex-1 text-xs font-mono truncate">{step.label}</span>
        {step.durationMs != null && (
          <span className="text-[10px] opacity-50 font-mono flex-shrink-0">
            {step.durationMs}ms
          </span>
        )}
        {step.status === "running" && (
          <span className="flex-shrink-0 flex gap-0.5">
            <span className="w-1 h-1 rounded-full bg-current thinking-dot-1" />
            <span className="w-1 h-1 rounded-full bg-current thinking-dot-2" />
            <span className="w-1 h-1 rounded-full bg-current thinking-dot-3" />
          </span>
        )}
        {step.detail && (
          <ChevronDown
            className={clsx(
              "w-3 h-3 flex-shrink-0 opacity-50 transition-transform",
              expanded && "rotate-180"
            )}
          />
        )}
      </button>

      {expanded && step.detail && (
        <div className="mt-1 ml-6 p-2.5 rounded-lg bg-surface-3 border border-border">
          <pre className="text-[11px] font-mono text-ink-muted whitespace-pre-wrap break-words leading-relaxed">
            {step.detail}
          </pre>
        </div>
      )}
    </div>
  )
}

interface AgentTraceProps {
  steps: AgentStep[]
}

export function AgentTrace({ steps }: AgentTraceProps) {
  const [open, setOpen] = useState(true)

  if (!steps.length) return null

  const running = steps.filter(s => s.status === "running").length
  const done    = steps.filter(s => s.status === "done").length
  const errors  = steps.filter(s => s.status === "error").length
  const totalMs = steps.reduce((a, s) => a + (s.durationMs ?? 0), 0)

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-1 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3.5 py-2.5
                   hover:bg-surface-2 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-accent-purple" />
          <span className="text-xs font-heading font-bold text-ink">
            Agent Trace
          </span>
          <span className="text-[10px] font-mono text-ink-faint">
            {steps.length} steps
          </span>
          {running > 0 && (
            <span className="flex gap-0.5 ml-1">
              <span className="w-1 h-1 rounded-full bg-accent-blue thinking-dot-1" />
              <span className="w-1 h-1 rounded-full bg-accent-blue thinking-dot-2" />
              <span className="w-1 h-1 rounded-full bg-accent-blue thinking-dot-3" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {errors > 0 && (
            <span className="text-[10px] font-mono text-accent-red">{errors} err</span>
          )}
          {totalMs > 0 && (
            <span className="text-[10px] font-mono text-ink-faint">{totalMs}ms</span>
          )}
          <ChevronDown
            className={clsx(
              "w-3.5 h-3.5 text-ink-faint transition-transform",
              open && "rotate-180"
            )}
          />
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 flex flex-col gap-1.5 border-t border-border">
          <div className="pt-2" />
          {steps.map(step => (
            <StepRow key={step.id} step={step} />
          ))}
        </div>
      )}
    </div>
  )
}
