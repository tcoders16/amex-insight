import { mcpHealth } from "@/lib/mcp-client"

export const runtime = "nodejs"

export async function GET() {
  const mcp = await mcpHealth()
  return Response.json({
    status:    "ok",
    ts:        new Date().toISOString(),
    mcp,
  })
}
