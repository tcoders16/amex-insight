import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ["var(--font-inter)"],
        heading: ["var(--font-space-grotesk)"],
        mono:    ["var(--font-jetbrains-mono)"],
      },
      colors: {
        surface: {
          DEFAULT: "#F8FAFC",
          1:       "#FFFFFF",
          2:       "#F1F5F9",
          3:       "#E2E8F0",
          4:       "#CBD5E1",
        },
        accent: {
          blue:       "#1D4ED8",   // primary brand — only accent color
          "blue-mid": "#2563EB",   // hover state
          "blue-soft":"#3B82F6",   // lighter interactive
          "blue-dim": "#DBEAFE",   // tinted bg
          green:      "#15803D",   // semantic: pass / success only
          red:        "#DC2626",   // semantic: error / fail only
        },
        border: {
          DEFAULT: "rgba(15,23,42,0.10)",
          strong:  "rgba(15,23,42,0.20)",
        },
        ink: {
          DEFAULT:   "#0F172A",
          secondary: "#1E293B",
          muted:     "#475569",
          faint:     "#94A3B8",
        },
      },
      backgroundImage: {
        "grid-subtle": "radial-gradient(circle, rgba(29,78,216,0.07) 1px, transparent 1px)",
        "glow-blue":   "radial-gradient(ellipse at 50% 0%, rgba(29,78,216,0.10) 0%, transparent 60%)",
      },
      backgroundSize: {
        "grid-subtle": "32px 32px",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        "fade-in":    "fadeIn 0.35s ease forwards",
        "slide-up":   "slideUp 0.35s ease forwards",
      },
      keyframes: {
        fadeIn:  { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { opacity: "0", transform: "translateY(10px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
      boxShadow: {
        "glass":     "0 1px 3px rgba(15,23,42,0.06), 0 4px 24px rgba(15,23,42,0.05)",
        "glass-md":  "0 2px 8px rgba(15,23,42,0.08), 0 8px 32px rgba(15,23,42,0.06)",
        "glow-blue": "0 0 24px rgba(29,78,216,0.18)",
        "glow-gold": "0 0 20px rgba(180,83,9,0.14)",
        "card":      "0 1px 4px rgba(15,23,42,0.06), 0 2px 12px rgba(15,23,42,0.04)",
        "elevated":  "0 4px 16px rgba(15,23,42,0.10), 0 1px 4px rgba(15,23,42,0.06)",
      },
    },
  },
  plugins: [],
}

export default config
