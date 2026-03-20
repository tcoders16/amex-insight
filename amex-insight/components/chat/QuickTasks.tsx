"use client"

import { FileText, TrendingUp, Search, AlertTriangle, BarChart2, Sparkles, Shield, Database } from "lucide-react"

const TASKS = [
  {
    icon: <FileText className="w-4 h-4" />,
    label: "Financial Brief",
    description: "Q3 2024 performance summary",
    prompt: "Generate a comprehensive Q3 2024 performance brief for American Express including revenue, network volumes, and strategic highlights.",
    color: "blue",
  },
  {
    icon: <Search className="w-4 h-4" />,
    label: "Deep Investigation",
    description: "Why did card spending slow?",
    prompt: "Investigate and explain why AMEX card member spending growth slowed in 2024. Use available financial documents to trace the root cause.",
    color: "purple",
  },
  {
    icon: <TrendingUp className="w-4 h-4" />,
    label: "Compare Years",
    description: "AI strategy 2022 vs 2024",
    prompt: "Compare AMEX's AI and technology investment strategy between 2022 and 2024 annual reports. How has the approach evolved?",
    color: "green",
  },
  {
    icon: <BarChart2 className="w-4 h-4" />,
    label: "Extract KPIs",
    description: "Structured financial data",
    prompt: "Extract all key financial KPIs from the AMEX 2024 annual report — revenue, volumes, growth rates — as structured data with citations.",
    color: "blue",
  },
  {
    icon: <AlertTriangle className="w-4 h-4" />,
    label: "Risk Assessment",
    description: "Top growth risks + severity",
    prompt: "Identify and assess the top 3 risks to AMEX's growth trajectory. Rate each by severity and provide evidence from financial documents.",
    color: "amber",
  },
  {
    icon: <Sparkles className="w-4 h-4" />,
    label: "EPS Analysis",
    description: "Earnings per share trend",
    prompt: "Analyse American Express EPS trends from 2020 to 2024. How has diluted EPS changed and what are the key drivers?",
    color: "purple",
  },
]

const HOW_IT_WORKS = [
  { icon: <Database className="w-3.5 h-3.5" />, label: "Retrieves from 10-K filings" },
  { icon: <Shield className="w-3.5 h-3.5" />, label: "Validates with NLI faithfulness" },
  { icon: <Sparkles className="w-3.5 h-3.5" />, label: "Cites every page & section" },
]

interface QuickTasksProps {
  onSelect: (prompt: string) => void
  disabled?: boolean
}

export function QuickTasks({ onSelect, disabled }: QuickTasksProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">

      {/* Hero */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full
                        border border-accent-blue/20 bg-accent-blue/5 mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
          <span className="text-[11px] font-mono text-accent-blue font-semibold uppercase tracking-wider">
            Agentic RAG · MCP · Live
          </span>
        </div>

        <h1 className="font-heading font-bold text-[40px] mb-3 leading-none tracking-tight">
          <span className="gradient-hero">AmexInsight</span>
        </h1>
        <p className="text-ink-muted text-[14px] max-w-md mx-auto leading-relaxed">
          Ask anything about AMEX financial documents — grounded answers with page citations.
        </p>
      </div>

      {/* Task grid — 3 columns of 2 */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        {TASKS.map(task => (
          <button
            key={task.label}
            onClick={() => !disabled && onSelect(task.prompt)}
            disabled={disabled}
            className="flex flex-col gap-2 p-3.5 rounded-2xl border border-border bg-white
                       text-left transition-all duration-200 shadow-card
                       hover:border-accent-blue/30 hover:shadow-elevated hover:bg-accent-blue/2
                       disabled:opacity-40 disabled:cursor-not-allowed group"
          >
            <span className="w-7 h-7 rounded-lg bg-surface-2 border border-border
                             flex items-center justify-center text-ink-muted
                             group-hover:bg-accent-blue/10 group-hover:border-accent-blue/20
                             group-hover:text-accent-blue transition-all duration-200">
              {task.icon}
            </span>
            <div>
              <div className="text-[13px] font-heading font-semibold text-ink mb-0.5 leading-snug">{task.label}</div>
              <div className="text-[11px] text-ink-faint leading-snug">{task.description}</div>
            </div>
          </button>
        ))}
      </div>

      {/* How it works chips */}
      <div className="flex items-center justify-center gap-3 mb-5">
        {HOW_IT_WORKS.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                            bg-surface-2 border border-border">
              <span className="text-ink-faint">{item.icon}</span>
              <span className="text-[11px] font-mono text-ink-faint">{item.label}</span>
            </div>
            {i < HOW_IT_WORKS.length - 1 && (
              <span className="text-ink-faint/40 text-xs">→</span>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-[11.5px] font-mono text-ink-faint/70">
        or type your own question below ↓
      </p>
    </div>
  )
}
