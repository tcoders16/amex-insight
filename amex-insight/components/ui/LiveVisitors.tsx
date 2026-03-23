"use client"

import { useEffect, useState } from "react"
import { clsx } from "clsx"

export function LiveVisitors() {
  const [count,   setCount]   = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [bump,    setBump]    = useState(false)

  async function fetchCount() {
    try {
      const res  = await fetch("/api/presence")
      const data = await res.json()
      setCount(prev => {
        if (prev !== null && prev !== data.count) {
          // Animate on change
          setBump(true)
          setTimeout(() => setBump(false), 600)
        }
        return data.count
      })
    } catch {
      // silently keep last known value
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCount()
    // Refresh every 30s
    const id = setInterval(fetchCount, 30_000)
    return () => clearInterval(id)
  }, [])

  if (loading || count === null) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-ink-faint font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-green/40 animate-pulse" />
        <span className="text-[10px]">—</span>
        <span className="text-[10px] hidden sm:inline">live</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 text-xs font-mono">
      {/* Pulsing dots — one per visitor up to 5 */}
      <div className="flex items-center gap-0.5">
        {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-accent-green"
            style={{ animationDelay: `${i * 180}ms` }}
          />
        ))}
        {count > 5 && (
          <span className="text-[9px] text-accent-green/70 ml-0.5">+{count - 5}</span>
        )}
      </div>

      <span className={clsx(
        "text-accent-green font-semibold transition-all duration-300",
        bump && "scale-125"
      )}>
        {count}
      </span>

      <span className="text-ink-faint text-[10px] hidden sm:inline">live</span>
    </div>
  )
}
