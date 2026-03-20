"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { clsx } from "clsx"
import { SquarePen } from "lucide-react"

const NAV = [
  { href: "/",             label: "Chat" },
  { href: "/architecture", label: "Architecture" },
  { href: "/tools",        label: "MCP Tools" },
]

export function Navbar() {
  const path   = usePathname()
  const router = useRouter()
  const isChat = path === "/"

  function newChat() {
    // Dispatch a custom event so ChatInterface can reset its state
    window.dispatchEvent(new CustomEvent("amex:new-chat"))
    // If not already on chat page, navigate there
    if (!isChat) router.push("/")
  }

  return (
    <header className="fixed top-0 inset-x-0 z-50 h-14 border-b border-border bg-surface/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-blue to-purple-500
                          flex items-center justify-center shadow-glow-blue">
            <span className="text-white font-mono font-bold text-xs">AI</span>
          </div>
          <span className="font-heading font-bold text-sm tracking-tight text-ink">
            Amex<span className="gradient-blue">Insight</span>
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
                path === href
                  ? "bg-accent-blue/10 text-accent-blue border border-accent-blue/20"
                  : "text-ink-muted hover:text-ink hover:bg-surface-2"
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right side: New Chat + status */}
        <div className="flex items-center gap-3">
          <button
            onClick={newChat}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium",
              "transition-all duration-150 border",
              isChat
                ? "bg-accent-blue text-white border-accent-blue hover:bg-accent-blue-mid shadow-glow-blue"
                : "text-ink-muted border-border hover:text-ink hover:bg-surface-2 hover:border-border"
            )}
          >
            <SquarePen className="w-3.5 h-3.5" />
            New Chat
          </button>

          <div className="flex items-center gap-2 text-xs text-ink-faint">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse-slow" />
            <span className="font-mono">MCP ONLINE</span>
          </div>
        </div>
      </div>
    </header>
  )
}
