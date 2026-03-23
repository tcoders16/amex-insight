/**
 * Presence API — real-time visitor tracking via Upstash Redis.
 *
 * POST /api/presence  { sessionId: string }
 *   → registers/refreshes a session with 90s TTL
 *   → returns { count: number }
 *
 * GET /api/presence
 *   → returns current active visitor count { count: number }
 *
 * Falls back to time-seeded simulation if Redis is not configured.
 */

import { Redis } from "@upstash/redis"

export const runtime = "edge"

const PREFIX = "amex:presence:"

function getRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

// Fallback: deterministic simulation when Redis not configured
function simulatedCount(): number {
  const window = Math.floor(Date.now() / (2 * 60 * 1000))
  const x = Math.sin(window * 7919) * 10000
  const base = 4 + Math.floor((x - Math.floor(x)) * 5)
  const sub = Math.floor(Date.now() / (30 * 1000))
  const y = Math.sin(sub * 6271) * 10000
  const noise = Math.floor((y - Math.floor(y)) * 3) - 1
  return Math.max(2, base + noise)
}

export async function POST(req: Request) {
  const redis = getRedis()

  let sessionId: string
  try {
    const body = await req.json()
    sessionId  = String(body.sessionId ?? "").slice(0, 64)
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 })
  }

  if (!sessionId) {
    return Response.json({ error: "sessionId required" }, { status: 400 })
  }

  if (!redis) {
    return Response.json({ count: simulatedCount(), simulated: true })
  }

  // Set this session with 90s TTL (refreshed every 30s from client)
  await redis.set(`${PREFIX}${sessionId}`, "1", { ex: 90 })

  // Count all active sessions
  const keys  = await redis.keys(`${PREFIX}*`)
  const count = keys.length

  return Response.json({ count })
}

export async function GET() {
  const redis = getRedis()

  if (!redis) {
    return Response.json({ count: simulatedCount(), simulated: true })
  }

  const keys  = await redis.keys(`${PREFIX}*`)
  const count = keys.length

  return Response.json({ count })
}
