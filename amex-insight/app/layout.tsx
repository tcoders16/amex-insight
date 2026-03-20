import type { Metadata } from "next"
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { Navbar } from "@/components/ui/Navbar"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "AmexInsight — Agentic Financial Intelligence",
  description:
    "Production agentic RAG system over AMEX public financial documents. Built by Omkumar Solanki.",
  openGraph: {
    title: "AmexInsight — Agentic Financial Intelligence",
    description: "Agentic RAG · MCP Server · 6-Layer Anti-Hallucination · Sub-4% Hallucination Rate",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-surface text-ink antialiased min-h-screen">
        <div className="scan-line" aria-hidden="true" />
        <Navbar />
        <main className="relative z-10">{children}</main>
      </body>
    </html>
  )
}
