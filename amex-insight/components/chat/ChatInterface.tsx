"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, RotateCcw, Brain, Zap, CheckCircle, AlertCircle,
         FileText, Shield, ChevronDown, Search, BookMarked, Sparkles,
         MessageSquare, Clock, SquarePen, ChevronRight } from "lucide-react"
import { clsx } from "clsx"
import { MessageBubble } from "./MessageBubble"
import { QuickTasks } from "./QuickTasks"
import { McpInspector, type McpLog } from "@/components/agent/McpInspector"
import { HallucinationDefense } from "@/components/rag/HallucinationDefense"
import type { ChatMessage, AgentStep, SessionStats, SessionMemory } from "@/lib/types"

// ─── Chat session (history entry) ─────────────────────────────────────────────

interface ChatSession {
  id:       string
  title:    string           // first user message, truncated
  messages: ChatMessage[]
  memories: SessionMemory[]
  ts:       number
}

// ─── Step type config ─────────────────────────────────────────────────────────

const STEP_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  plan:         { icon: <Brain className="w-3 h-3" />,       label: "Plan",        color: "text-violet-500" },
  tool_call:    { icon: <Zap className="w-3 h-3" />,         label: "Tool",        color: "text-accent-blue" },
  tool_result:  { icon: <CheckCircle className="w-3 h-3" />, label: "Result",      color: "text-accent-blue" },
  reasoning:    { icon: <Brain className="w-3 h-3" />,       label: "Reason",      color: "text-violet-500" },
  faithfulness: { icon: <Shield className="w-3 h-3" />,      label: "Check",       color: "text-amber-500" },
  synthesis:    { icon: <FileText className="w-3 h-3" />,    label: "Synthesize",  color: "text-accent-green" },
  error:        { icon: <AlertCircle className="w-3 h-3" />, label: "Error",       color: "text-accent-red" },
}

// ─── Live step row ─────────────────────────────────────────────────────────────

function LiveStep({ step, index }: { step: AgentStep; index: number }) {
  const [open, setOpen] = useState(false)
  const meta    = STEP_META[step.type] ?? STEP_META.reasoning
  const isError = step.type === "error" || step.status === "error"
  const isDone  = step.status === "done"
  const isRun   = step.status === "running"

  // ── Compact done row ────────────────────────────────────────────────────────
  if (isDone && !isError) {
    return (
      <div className="animate-slide-up">
        <button
          onClick={() => step.detail && setOpen(!open)}
          className={clsx(
            "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left",
            "transition-all duration-150 group",
            step.detail ? "hover:bg-gray-100 cursor-pointer" : "cursor-default"
          )}
        >
          <div className="flex-shrink-0 w-4 flex flex-col items-center gap-0.5">
            <div className="w-px h-2 bg-gray-200" />
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            <div className="w-px h-2 bg-gray-200" />
          </div>
          <span className="flex-1 text-[12px] font-mono text-gray-400 truncate leading-none group-hover:text-gray-600 transition-colors">
            {step.label}
          </span>
          {step.durationMs != null && (
            <span className="text-[10.5px] font-mono text-gray-300 flex-shrink-0 tabular-nums">
              {step.durationMs < 1000 ? `${step.durationMs}ms` : `${(step.durationMs / 1000).toFixed(1)}s`}
            </span>
          )}
          {step.detail && (
            <ChevronDown className={clsx("w-3 h-3 text-gray-300 flex-shrink-0 transition-transform", open && "rotate-180")} />
          )}
        </button>
        {open && step.detail && (
          <div className="ml-8 mr-2 mb-1.5 p-2.5 rounded-lg bg-gray-50 border border-gray-200">
            <pre className="text-[11px] font-mono text-gray-500 whitespace-pre-wrap break-words leading-relaxed">
              {step.detail.length > 600 ? step.detail.slice(0, 600) + "…" : step.detail}
            </pre>
          </div>
        )}
      </div>
    )
  }

  // ── Error row ───────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="animate-slide-up flex items-center gap-2 px-3 py-1.5">
        <div className="flex-shrink-0 w-4 flex flex-col items-center gap-0.5">
          <div className="w-px h-2 bg-gray-200" />
          <AlertCircle className="w-3 h-3 text-red-500" />
          <div className="w-px h-2 bg-gray-200" />
        </div>
        <span className="text-[11.5px] font-mono text-red-500 truncate">{step.label}</span>
      </div>
    )
  }

  // ── Active / running row ─────────────────────────────────────────────────────
  return (
    <div className="animate-slide-up px-2">
      <div className="flex items-start gap-3 px-3 py-2.5 rounded-xl border border-blue-100 bg-blue-50 ring-1 ring-blue-100/80">
        <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-blue-500 mt-0.5">
          <div className="animate-pulse">{meta.icon}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-500">
              {meta.label}
            </span>
            <span className="text-[10px] font-mono text-gray-400">#{index + 1}</span>
          </div>
          <p className="text-[12px] font-medium text-gray-700 leading-snug break-words">{step.label}</p>
        </div>
        <div className="flex-shrink-0 pt-0.5">
          <svg className="w-3.5 h-3.5 animate-spin text-blue-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
          </svg>
        </div>
      </div>
    </div>
  )
}

// ─── Session stats bar ────────────────────────────────────────────────────────

function SessionStatsBar({ stats }: { stats: SessionStats }) {
  const items = [
    { label: "Tool calls",  value: stats.toolCalls },
    { label: "Retried",     value: stats.retried },
    { label: "DLQ",         value: stats.dlq,   warn: stats.dlq > 0 },
    { label: "Recovered",   value: stats.recovered },
    { label: "Avg latency", value: stats.avgLatencyMs > 0 ? `${stats.avgLatencyMs}ms` : "—" },
  ]
  return (
    <div className="flex items-center gap-6 px-6 py-2.5 border-b border-gray-200 bg-white/70">
      {items.map(s => (
        <div key={s.label} className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-400">{s.label}</span>
          <span className={clsx(
            "text-[12px] font-semibold font-mono stat-num",
            (s as any).warn ? "text-red-500" : "text-gray-700"
          )}>
            {s.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Empty activity state ─────────────────────────────────────────────────────

function EmptyActivity() {
  const steps = [
    { icon: <Brain className="w-3 h-3" />,    label: "Analyse & plan query",     color: "text-violet-500" },
    { icon: <Zap className="w-3 h-3" />,      label: "Call MCP tools",           color: "text-blue-500" },
    { icon: <Search className="w-3 h-3" />,   label: "Retrieve + rerank chunks", color: "text-blue-500" },
    { icon: <Shield className="w-3 h-3" />,   label: "Faithfulness check",       color: "text-amber-500" },
    { icon: <FileText className="w-3 h-3" />, label: "Synthesise answer",        color: "text-emerald-500" },
  ]
  return (
    <div className="flex flex-col gap-0 py-2 px-1">
      <p className="text-[10px] font-mono font-semibold text-gray-400 px-3 mb-2 uppercase tracking-wider">
        ReAct loop · waiting
      </p>
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <div className="flex-shrink-0 w-4 flex flex-col items-center">
            {i > 0 && <div className="w-px h-2 bg-gray-200 mb-0.5" />}
            <span className={s.color}>{s.icon}</span>
          </div>
          <span className="text-[12px] font-mono text-gray-500">{s.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Session Memory Panel ─────────────────────────────────────────────────────

function SessionMemoryPanel({ memories }: { memories: SessionMemory[] }) {
  if (memories.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-3">
        <BookMarked className="w-3 h-3 text-gray-300 flex-shrink-0" />
        <span className="text-[11px] font-mono text-gray-400">
          Verified facts appear here as you chat
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {[...memories].reverse().map(m => (
        <div
          key={m.id}
          className={clsx(
            "px-3 py-2 rounded-lg border-l-2 animate-slide-up",
            m.verified
              ? "border-emerald-400 bg-emerald-50"
              : "border-amber-400 bg-amber-50"
          )}
        >
          <p className="text-[11.5px] text-gray-700 leading-snug">{m.fact}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] font-mono text-gray-400">{m.source}</span>
            {m.verified && (
              <span className="text-[9px] font-mono font-bold text-emerald-500 uppercase tracking-wider">
                · verified
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChatInterface() {
  const [messages, setMessages]   = useState<ChatMessage[]>([])
  const [input, setInput]         = useState("")
  const [loading, setLoading]     = useState(false)
  const [mcpLogs, setMcpLogs]     = useState<McpLog[]>([])
  const [memories, setMemories]   = useState<SessionMemory[]>([])
  const [sessions, setSessions]   = useState<ChatSession[]>([])
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [stats, setStats]         = useState<SessionStats>({
    toolCalls: 0, retried: 0, dlq: 0, recovered: 0, avgLatencyMs: 0,
  })

  const bottomRef    = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLTextAreaElement>(null)
  const latenciesRef = useRef<number[]>([])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Keep refs to current messages/memories so event handlers can read latest values
  const messagesRef  = useRef<ChatMessage[]>([])
  const memoriesRef  = useRef<SessionMemory[]>([])
  const lastSaveRef  = useRef(0) // debounce guard — prevent duplicate saves
  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { memoriesRef.current = memories }, [memories])

  // Save current chat to history then reset
  const startNewChat = useCallback(() => {
    // Debounce: ignore calls within 300ms of each other (StrictMode / double-fire guard)
    const now = Date.now()
    if (now - lastSaveRef.current < 300) return
    lastSaveRef.current = now

    const currentMessages = messagesRef.current
    const currentMemories = memoriesRef.current

    if (currentMessages.length > 0) {
      const firstUser = currentMessages.find(m => m.role === "user")
      const title = firstUser?.content.slice(0, 50) ?? "Chat"
      const ts = Date.now()
      const session: ChatSession = {
        id: `sess-${ts}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        messages: currentMessages,
        memories: currentMemories,
        ts,
      }
      setSessions(prev => {
        // Deduplicate by title + message count to prevent identical entries
        const isDuplicate = prev.some(
          s => s.title === session.title && s.messages.length === session.messages.length
        )
        if (isDuplicate) return prev
        return [session, ...prev].slice(0, 20)
      })
    }
    setMessages([])
    setMcpLogs([])
    setMemories([])
    setActiveSession(null)
    setStats({ toolCalls: 0, retried: 0, dlq: 0, recovered: 0, avgLatencyMs: 0 })
    latenciesRef.current = []
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  // Listen for "New Chat" event from Navbar — use ref to guarantee single listener
  const handlerRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    if (handlerRef.current) window.removeEventListener("amex:new-chat", handlerRef.current)
    handlerRef.current = startNewChat
    window.addEventListener("amex:new-chat", handlerRef.current)
    return () => {
      if (handlerRef.current) window.removeEventListener("amex:new-chat", handlerRef.current)
    }
  }, [startNewChat])

  // Restore a past session
  const restoreSession = useCallback((session: ChatSession) => {
    const currentMsgs = messagesRef.current
    if (currentMsgs.length > 0) {
      const firstUser = currentMsgs.find(m => m.role === "user")
      const title = firstUser?.content.slice(0, 50) ?? "Chat"
      const ts = Date.now()
      const current: ChatSession = {
        id: `sess-${ts}-${Math.random().toString(36).slice(2, 7)}`,
        title, messages: currentMsgs, memories: memoriesRef.current, ts,
      }
      setSessions(prev => {
        const isDup = prev.some(s => s.title === current.title && s.messages.length === current.messages.length)
        if (isDup) return prev.filter(x => x.id !== session.id)
        return [current, ...prev.filter(x => x.id !== session.id)].slice(0, 20)
      })
    }
    setMessages(session.messages)
    setMemories(session.memories)
    setMcpLogs([])
    setActiveSession(session.id)
    latenciesRef.current = []
  }, [])

  // Derive live agent state
  const lastAssistant = messages.filter(m => m.role === "assistant").at(-1)
  const activeSteps   = lastAssistant?.steps ?? []
  const isStreaming   = lastAssistant?.streaming ?? false
  const lastFaith     = lastAssistant?.faithfulness
  const lastConf      = lastAssistant?.confidence
  const lastDlq       = lastAssistant?.dlqEntries
  const hasReranked   = activeSteps.some(s => s.type === "tool_result")

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || loading) return

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: content.trim() }
    const assistantId = `a-${Date.now()}`
    const assistantMsg: ChatMessage = {
      id: assistantId, role: "assistant", content: "", steps: [], streaming: true,
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
        }),
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const raw = line.slice(6).trim()
          if (raw === "[DONE]") continue
          try {
            const event = JSON.parse(raw)

            if (event.type === "text") {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: m.content + event.delta } : m
              ))
            }
            if (event.type === "step") {
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, steps: [...(m.steps ?? []), event.step as AgentStep] }
                  : m
              ))
            }
            if (event.type === "step_update") {
              setMessages(prev => prev.map(m => {
                if (m.id !== assistantId) return m
                return {
                  ...m,
                  steps: (m.steps ?? []).map(s =>
                    s.id === event.stepId ? { ...s, ...event.update } : s
                  ),
                }
              }))
            }
            if (event.type === "mcp_log") {
              const log = event.log as McpLog
              setMcpLogs(prev => [...prev, log])
              if (log.direction === "request")
                setStats(prev => ({ ...prev, toolCalls: prev.toolCalls + 1 }))
            }
            if (event.type === "done") {
              const { citations, faithfulness, confidence, dlqEntries, retries, memories: newMems } = event
              if (newMems?.length) {
                setMemories(prev => {
                  // Dedupe by fact text, keep max 30 across session
                  const existing = new Set(prev.map((m: SessionMemory) => m.fact.slice(0, 60)))
                  const fresh = (newMems as SessionMemory[]).filter(
                    (m: SessionMemory) => !existing.has(m.fact.slice(0, 60))
                  )
                  return [...prev, ...fresh].slice(-30)
                })
              }
              if (retries > 0)    setStats(prev => ({ ...prev, retried:   prev.retried + retries }))
              if (dlqEntries > 0) setStats(prev => ({ ...prev, dlq:       prev.dlq + dlqEntries }))
              if (retries > 0 && dlqEntries === 0)
                setStats(prev => ({ ...prev, recovered: prev.recovered + retries }))
              if (event.durationMs) {
                latenciesRef.current.push(event.durationMs)
                const avg = Math.round(
                  latenciesRef.current.reduce((a, b) => a + b, 0) / latenciesRef.current.length
                )
                setStats(prev => ({ ...prev, avgLatencyMs: avg }))
              }
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, streaming: false, citations: citations ?? [],
                      faithfulness, confidence, dlqEntries: dlqEntries ?? 0, retries: retries ?? 0 }
                  : m
              ))
            }
          } catch { /* non-JSON */ }
        }
      }
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, streaming: false,
              content: "I encountered an error processing your request. Please try again." }
          : m
      ))
    } finally {
      setLoading(false)
    }
  }, [messages, loading])

  const handleSubmit  = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input) }
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }
  const reset = () => startNewChat()

  const isEmpty = messages.length === 0

  return (
    <div className="flex h-[calc(100vh-56px)] bg-surface">

      {/* ── Left Sidebar: Chat History ──────────────────────────────────── */}
      <div className="w-[220px] flex-shrink-0 flex flex-col bg-[#F0F4F8] border-r border-border overflow-hidden">

        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border bg-white/60">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-accent-blue" />
            <span className="text-[12px] font-semibold text-ink">Chats</span>
          </div>
          <button
            onClick={() => startNewChat()}
            className="p-1 rounded-md text-ink-faint hover:text-accent-blue hover:bg-accent-blue/8 transition-colors"
            title="New chat"
          >
            <SquarePen className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Current chat (if has messages) */}
        {!isEmpty && (
          <div className="px-2 pt-2">
            <div className={clsx(
              "flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-default",
              "bg-accent-blue/10 border border-accent-blue/20"
            )}>
              <div className="w-1.5 h-1.5 rounded-full bg-accent-blue mt-1.5 flex-shrink-0 animate-pulse-slow" />
              <div className="min-w-0">
                <p className="text-[11.5px] font-medium text-accent-blue truncate leading-snug">
                  {messages.find(m => m.role === "user")?.content.slice(0, 36) ?? "New chat"}
                </p>
                <span className="text-[10px] font-mono text-accent-blue/60">Active</span>
              </div>
            </div>
          </div>
        )}

        {/* History list */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {sessions.length === 0 && isEmpty && (
            <div className="flex flex-col items-center justify-center gap-3 py-8 px-3 text-center">
              <div className="w-8 h-8 rounded-xl bg-surface-3 border border-border flex items-center justify-center">
                <Clock className="w-4 h-4 text-ink-faint" />
              </div>
              <div>
                <p className="text-[11.5px] font-semibold text-ink-muted mb-0.5">No chats yet</p>
                <p className="text-[10.5px] font-mono text-ink-faint leading-relaxed">
                  Start a conversation to<br />see your history here
                </p>
              </div>
            </div>
          )}
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => restoreSession(s)}
              className={clsx(
                "w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition-all",
                activeSession === s.id
                  ? "bg-white border border-border shadow-card"
                  : "hover:bg-white/70"
              )}
            >
              <MessageSquare className="w-3 h-3 text-ink-faint mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] text-ink truncate leading-snug">{s.title}</p>
                <span className="text-[10px] font-mono text-ink-faint">
                  {s.messages.filter(m => m.role === "user").length} msg
                  {s.memories.length > 0 ? ` · ${s.memories.length} facts` : ""}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Sidebar footer */}
        <div className="px-4 py-3 border-t border-border">
          <p className="text-[10px] font-mono text-ink-faint text-center">
            {sessions.length} past session{sessions.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* ── Center: Chat ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">

        {!isEmpty && <SessionStatsBar stats={stats} />}

        <div className="flex-1 overflow-y-auto">
          <div className={clsx(
            "max-w-2xl mx-auto",
            isEmpty
              ? "flex items-center justify-center min-h-full px-6 pb-20"
              : "px-6 py-10 space-y-8"
          )}>
            {isEmpty
              ? <QuickTasks onSelect={sendMessage} disabled={loading} />
              : messages.map(m => <MessageBubble key={m.id} message={m} />)
            }
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input bar */}
        <div className="border-t border-border bg-white/80 backdrop-blur-sm p-5">
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSubmit} className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about AMEX financials, revenue, strategy..."
                rows={1}
                disabled={loading}
                className={clsx(
                  "w-full resize-none rounded-2xl border border-border bg-white",
                  "px-5 py-3.5 pr-14 text-[14px] text-ink placeholder:text-ink-faint",
                  "focus:outline-none focus:border-accent-blue/50 focus:ring-3 focus:ring-accent-blue/8",
                  "transition-all duration-150 font-sans leading-relaxed shadow-card",
                  "disabled:opacity-50 max-h-40 overflow-y-auto"
                )}
                style={{ minHeight: "52px" }}
              />
              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className={clsx(
                    "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150",
                    input.trim() && !loading
                      ? "bg-accent-blue text-white hover:bg-accent-blue-mid shadow-glow-blue"
                      : "bg-surface-3 text-ink-faint cursor-not-allowed"
                  )}
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
            <p className="mt-2.5 text-center text-[11px] font-mono text-ink-faint">
              ↵ send · shift+↵ newline · HMAC-signed · zero telemetry on financial data
            </p>
          </div>
        </div>
      </div>

      {/* ── Right Panel — Claude light style ────────────────────────── */}
      <div className="w-[360px] flex-shrink-0 flex flex-col bg-gray-50 border-l border-gray-200 overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className={clsx(
              "w-2 h-2 rounded-full flex-shrink-0",
              isStreaming ? "bg-blue-400 animate-pulse" : "bg-emerald-400"
            )} />
            <span className="text-[12px] font-mono font-semibold text-gray-700">amex-insight</span>
            {isStreaming && (
              <span className="flex gap-0.5 ml-1">
                <span className="w-1 h-1 rounded-full bg-blue-400 thinking-dot-1" />
                <span className="w-1 h-1 rounded-full bg-blue-400 thinking-dot-2" />
                <span className="w-1 h-1 rounded-full bg-blue-400 thinking-dot-3" />
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeSteps.length > 0 && (
              <span className="text-[10px] font-mono text-gray-400 tabular-nums">
                {activeSteps.filter(s => s.status === "done").length}/{activeSteps.length}
              </span>
            )}
            <span className={clsx(
              "text-[10px] font-mono font-semibold uppercase tracking-wider",
              isStreaming ? "text-blue-500" : "text-emerald-500"
            )}>
              {isStreaming ? "running" : "ready"}
            </span>
          </div>
        </div>

        {/* ── Agent Steps card ── */}
        <div className="mx-3 mt-3 mb-0 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm flex-shrink-0">
          {/* card header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-gray-100">
            <span className="text-[12px] font-semibold text-gray-700">Progress</span>
            {activeSteps.length > 0 && (
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            )}
          </div>
          <div className={clsx(
            "overflow-y-auto",
            activeSteps.length === 0 ? "" : "max-h-[220px]"
          )}>
            {activeSteps.length === 0 ? (
              <EmptyActivity />
            ) : (
              <div className="flex flex-col py-1">
                {activeSteps.map((step, i) => (
                  <LiveStep key={step.id} step={step} index={i} />
                ))}
                {activeSteps.every(s => s.status === "done") && (
                  <div className="flex items-center gap-2 px-4 py-2">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-[10px] font-mono text-emerald-400">complete</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Session Memory card ── */}
        <div className="mx-3 mt-2.5 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <BookMarked className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[12px] font-semibold text-gray-700">Context</span>
              {memories.length > 0 && (
                <span className="text-[10px] font-mono font-bold text-white bg-blue-500
                                 px-1.5 py-0.5 rounded-full tabular-nums">
                  {memories.length}
                </span>
              )}
            </div>
            {isStreaming && memories.length > 0 && (
              <Sparkles className="w-3 h-3 text-amber-400 animate-pulse flex-shrink-0" />
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2.5">
            {memories.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center">
                <div className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center">
                  <BookMarked className="w-4 h-4 text-gray-300" />
                </div>
                <div>
                  <p className="text-[11.5px] font-semibold text-gray-500 mb-1">No facts yet</p>
                  <p className="text-[10.5px] font-mono text-gray-400 leading-relaxed">
                    Verified facts from retrieved<br />documents appear here
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {[...memories].reverse().map(m => (
                  <div
                    key={m.id}
                    className={clsx(
                      "px-3 py-2.5 rounded-lg border-l-2 animate-slide-up",
                      m.verified
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-amber-400 bg-amber-50"
                    )}
                  >
                    <p className="text-[11.5px] text-gray-700 leading-snug">{m.fact}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-mono text-gray-400">{m.source}</span>
                      {m.verified && (
                        <span className="text-[9px] font-mono font-bold text-emerald-500 uppercase tracking-wide">
                          ✓ verified
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex-shrink-0 pb-5 mt-auto">
          {/* Faithfulness bar */}
          {lastFaith != null && (
            <div className="mx-3 mt-2.5 px-3.5 py-3 rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-gray-400" />
                  <span className="text-[10.5px] font-mono text-gray-500">Faithfulness</span>
                </div>
                <span className={clsx(
                  "text-[11.5px] font-mono font-bold",
                  lastFaith >= 0.75 ? "text-emerald-500" : "text-red-500"
                )}>
                  {(lastFaith * 100).toFixed(0)}%
                  {lastFaith >= 0.75 ? " ✓" : " ✗"}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={clsx(
                    "h-full rounded-full transition-all duration-700",
                    lastFaith >= 0.75 ? "bg-emerald-400" : "bg-red-400"
                  )}
                  style={{ width: `${lastFaith * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] font-mono text-gray-400">
                  {activeSteps.filter(s => s.type === "tool_call").length} tools
                  {lastConf != null ? ` · ${Math.round(lastConf * 100)}% conf` : ""}
                </span>
                <span className={clsx(
                  "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded",
                  (lastDlq ?? 0) === 0
                    ? "text-emerald-500 bg-emerald-50"
                    : "text-red-500 bg-red-50"
                )}>
                  DLQ: {lastDlq ?? 0}
                </span>
              </div>
            </div>
          )}

          {/* Footer row */}
          <div className="flex items-center justify-between px-4 pt-2.5">
            <span className="text-[10.5px] font-mono text-gray-400">
              MCP {mcpLogs.filter(l => l.direction === "request").length}↑
              {" "}{mcpLogs.filter(l => l.direction === "response").length}↓
            </span>
            <a
              href="/architecture"
              className="flex items-center gap-1 text-[10.5px] font-mono text-blue-400
                         hover:text-blue-500 transition-colors"
            >
              Architecture →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
