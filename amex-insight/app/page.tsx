"use client"

import dynamic from "next/dynamic"

// Loaded client-side only — streaming + state requires browser
const ChatInterface = dynamic(
  () => import("@/components/chat/ChatInterface"),
  { ssr: false }
)

export default function HomePage() {
  return <ChatInterface />
}
