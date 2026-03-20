"use client"

import { Shield, CheckCircle, AlertTriangle } from "lucide-react"
import { clsx } from "clsx"

interface Layer {
  id:      number
  label:   string
  status:  "pass" | "fail" | "pending"
  metric?: string
}

const BASE_LAYERS: Layer[] = [
  { id: 1, label: "Zod Schema Validated",   status: "pending" },
  { id: 2, label: "RAG Grounded",           status: "pending" },
  { id: 3, label: "Cross-Encoder Reranked", status: "pending" },
  { id: 4, label: "Faithfulness Score",     status: "pending" },
  { id: 5, label: "Confidence Gate",        status: "pending" },
  { id: 6, label: "DLQ Sentinel",           status: "pending" },
]

interface HallucinationDefenseProps {
  faithfulness?: number
  confidence?:   number
  chunksUsed?:   number
  dlqEntries?:   number
  reranked?:     boolean
}

export function HallucinationDefense({
  faithfulness, confidence, chunksUsed, dlqEntries, reranked,
}: HallucinationDefenseProps) {
  const hasData = faithfulness != null

  const layers: Layer[] = BASE_LAYERS.map(l => {
    if (!hasData) return l
    switch (l.id) {
      case 1: return { ...l, status: "pass", metric: "Zod ✓" }
      case 2: return { ...l, status: "pass", metric: `${chunksUsed ?? 0} chunks` }
      case 3: return { ...l, status: reranked ? "pass" : "fail", metric: reranked ? "4 of 12" : "–" }
      case 4: return { ...l, status: (faithfulness ?? 0) >= 0.75 ? "pass" : "fail",
                       metric: faithfulness != null ? `${(faithfulness * 100).toFixed(0)}%` : undefined }
      case 5: return { ...l, status: (confidence ?? 0) >= 0.75 ? "pass" : "fail",
                       metric: confidence != null ? `${Math.round((confidence ?? 0) * 100)}%` : undefined }
      case 6: return { ...l, status: (dlqEntries ?? 0) === 0 ? "pass" : "fail",
                       metric: `DLQ: ${dlqEntries ?? 0}` }
      default: return l
    }
  })

  const allPass = hasData && layers.every(l => l.status === "pass")

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[12px] font-semibold text-gray-700">Hallucination Defense</span>
          <span className="text-[10px] font-mono text-gray-400">6 layers</span>
        </div>
        {hasData && (
          <span className={clsx(
            "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border",
            allPass
              ? "text-emerald-500 border-emerald-200 bg-emerald-50"
              : "text-blue-500 border-blue-200 bg-blue-50"
          )}>
            {allPass ? "ALL CLEAR" : "REVIEW"}
          </span>
        )}
      </div>

      {/* Layers */}
      <div className="px-3.5 py-2.5 flex flex-col gap-2">
        {layers.map(layer => (
          <div key={layer.id} className="flex items-center gap-2.5">
            <span className="text-[10px] font-mono text-gray-300 w-4 flex-shrink-0 text-right">
              {String(layer.id).padStart(2, "0")}
            </span>
            <span className="text-[12px] text-gray-600 font-medium flex-1 leading-none">
              {layer.label}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {layer.metric && (
                <span className="text-[10px] font-mono text-gray-400">{layer.metric}</span>
              )}
              {layer.status === "pass" ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              ) : layer.status === "fail" ? (
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-200" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Faithfulness bar */}
      {faithfulness != null && (
        <div className="px-3.5 pb-3 pt-1 border-t border-gray-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono text-gray-400">Faithfulness</span>
            <span className={clsx(
              "text-[11px] font-mono font-bold",
              faithfulness >= 0.75 ? "text-emerald-500" : "text-red-500"
            )}>
              {(faithfulness * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={clsx(
                "h-full rounded-full transition-all duration-700",
                faithfulness >= 0.75 ? "bg-emerald-400" : "bg-red-400"
              )}
              style={{ width: `${faithfulness * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
