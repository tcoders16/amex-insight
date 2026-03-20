import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: { ppr: false },
  env: {
    MCP_SERVER_URL:    process.env.MCP_SERVER_URL!,
    MCP_SHARED_SECRET: process.env.MCP_SHARED_SECRET!,
  },
  // OPENAI_API_KEY is accessed server-side only (in route handlers) — not exposed to client
}

export default nextConfig
