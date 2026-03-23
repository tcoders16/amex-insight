"use client"

import { useEffect, useState } from "react"
import { clsx } from "clsx"

function getSessionId(): string {
  // Persist session UUID in sessionStorage — unique per tab, survives HMR
  const key = "amex:sid"
  let   sid = sessionStorage.getItem(key)
  if (!sid) {
    sid = crypto.randomUUID()
    sessionStorage.setItem(key, sid)
  }
  return sid
}

export function LiveVisitors() {
  const [count,   setCount]   = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [bump,    setBump]    = useState(false)

  async function heartbeat() {
    try {
      const sid = getSessionId()
      const res = await fetch("/api/presence", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sessionId: sid }),
      })
      const data = await res.json()
      setCount(prev => {
        if (prev !== null && prev !== data.count) {
          setBump(true)
          setTimeout(() => setBump(false), 500)
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
    heartbeat()
    const id = setInterval(heartbeat, 30_000)
    return () => clearInterval(id)
  }, [])

  if (loading || count === null) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-ink-faint font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-green/40 animate-pulse" />
        <span className="text-[10px]">—</span>
      </div>
    )
  }

  const dots = Math.min(count, 5)

  return (
    <div className="flex items-center gap-1.5 font-mono">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: dots }).map((_, i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>

      <span className={clsx(
        "text-xs text-accent-green font-semibold transition-transform duration-300",
        bump && "scale-125"
      )}>
        {count}
      </span>

      <span className="text-[10px] text-ink-faint hidden sm:inline">live</span>
    </div>
  )
}
