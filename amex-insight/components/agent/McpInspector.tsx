"use client"

import { useState } from "react"
import { ChevronDown, Terminal, ArrowRight, ArrowLeft } from "lucide-react"
import { clsx } from "clsx"

export interface McpLog {
  id:        string
  direction: "request" | "response"
  tool:      string
  payload:   object
  durationMs?: number
  ts:        number
}

interface McpInspectorProps {
  logs: McpLog[]
}

function LogEntry({ log }: { log: McpLog }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
      >
        {log.direction === "request" ? (
          <ArrowRight className="w-3 h-3 text-blue-400 flex-shrink-0" />
        ) : (
          <ArrowLeft className="w-3 h-3 text-emerald-400 flex-shrink-0" />
        )}
        <span className={clsx(
          "text-[10px] font-mono font-bold flex-shrink-0 uppercase",
          log.direction === "request" ? "text-blue-400" : "text-emerald-400"
        )}>
          {log.direction === "request" ? "REQ" : "RES"}
        </span>
        <span className="text-[11px] font-mono text-gray-600 flex-1 truncate">
          {log.tool}
        </span>
        {log.durationMs != null && (
          <span className="text-[10px] font-mono text-gray-400">
            {log.durationMs}ms
          </span>
        )}
        <span className="text-[10px] font-mono text-gray-400">
          {new Date(log.ts).toLocaleTimeString("en", { hour12: false })}
        </span>
        <ChevronDown className={clsx(
          "w-3 h-3 text-gray-300 transition-transform flex-shrink-0",
          open && "rotate-180"
        )} />
      </button>

      {open && (
        <div className="px-3 pb-3">
          <pre className="text-[11px] font-mono text-gray-600 whitespace-pre-wrap break-words
                          bg-gray-50 rounded-lg p-2.5 border border-gray-200 leading-relaxed
                          max-h-48 overflow-y-auto">
            {JSON.stringify(log.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export function McpInspector({ logs }: McpInspectorProps) {
  const [open, setOpen] = useState(false)

  const requests  = logs.filter(l => l.direction === "request").length
  const responses = logs.filter(l => l.direction === "response").length

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3.5 py-2.5
                   hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[12px] font-semibold text-gray-700">
            MCP Inspector
          </span>
          <span className="text-[10px] font-mono text-gray-400">
            {requests}↑ {responses}↓
          </span>
        </div>
        <ChevronDown className={clsx(
          "w-3.5 h-3.5 text-gray-400 transition-transform",
          open && "rotate-180"
        )} />
      </button>

      {open && (
        <div className="border-t border-gray-100 max-h-72 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs font-mono text-gray-400">
              No MCP calls yet
            </div>
          ) : (
            logs.map(log => <LogEntry key={log.id} log={log} />)
          )}
        </div>
      )}
    </div>
  )
}
