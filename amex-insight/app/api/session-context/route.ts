/**
 * Session Context API
 *
 * GET  /api/session-context?sessionId=xxx  → { md: string, factCount: number }
 * DELETE /api/session-context?sessionId=xxx → { ok: true }
 * PATCH  /api/session-context               → { sessionId, block } → { ok: true }
 */

import {
  getSessionContext,
  deleteSessionContext,
  appendSessionFact,
  getSessionFactCount,
} from "@/lib/session-context"

export const runtime = "edge"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get("sessionId")?.slice(0, 64) ?? ""
  if (!sessionId) return Response.json({ error: "sessionId required" }, { status: 400 })

  const md        = await getSessionContext(sessionId)
  const factCount = (md.match(/^- /gm) ?? []).length

  return Response.json({ md, factCount })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get("sessionId")?.slice(0, 64) ?? ""
  if (!sessionId) return Response.json({ error: "sessionId required" }, { status: 400 })

  await deleteSessionContext(sessionId)
  return Response.json({ ok: true })
}

export async function PATCH(req: Request) {
  let body: { sessionId?: string; block?: string }
  try { body = await req.json() } catch { return Response.json({ error: "invalid JSON" }, { status: 400 }) }

  const sessionId = (body.sessionId ?? "").slice(0, 64)
  const block     = (body.block ?? "").slice(0, 4000)
  if (!sessionId || !block) return Response.json({ error: "sessionId and block required" }, { status: 400 })

  await appendSessionFact(sessionId, block)
  return Response.json({ ok: true })
}
