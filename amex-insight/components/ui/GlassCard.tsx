import { clsx } from "clsx"

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  glow?: "blue" | "gold" | "none"
  border?: boolean
}

export function GlassCard({
  children,
  className,
  glow = "none",
  border = true,
}: GlassCardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl glass",
        border && "border border-border",
        glow === "blue" && "shadow-glow-blue",
        glow === "gold" && "shadow-glow-gold",
        className
      )}
    >
      {children}
    </div>
  )
}

interface BadgeProps {
  children: React.ReactNode
  variant?: "blue" | "gold" | "green" | "red" | "purple" | "default"
  size?: "sm" | "md"
  dot?: boolean
}

export function Badge({
  children,
  variant = "default",
  size = "sm",
  dot = false,
}: BadgeProps) {
  const variants = {
    blue:    "bg-accent-blue/10 text-accent-blue border-accent-blue/20",
    gold:    "bg-accent-gold/10 text-accent-gold border-accent-gold/20",
    green:   "bg-accent-green/10 text-accent-green border-accent-green/20",
    red:     "bg-accent-red/10 text-accent-red border-accent-red/20",
    purple:  "bg-accent-purple/10 text-accent-purple border-accent-purple/20",
    default: "bg-surface-2 text-ink-muted border-border",
  }

  const sizes = {
    sm: "text-[10px] px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
  }

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border font-mono font-medium",
        variants[variant],
        sizes[size]
      )}
    >
      {dot && (
        <span
          className={clsx(
            "w-1.5 h-1.5 rounded-full",
            variant === "blue"   && "bg-accent-blue",
            variant === "gold"   && "bg-accent-gold",
            variant === "green"  && "bg-accent-green",
            variant === "red"    && "bg-accent-red",
            variant === "purple" && "bg-accent-purple",
            variant === "default" && "bg-ink-faint"
          )}
        />
      )}
      {children}
    </span>
  )
}
