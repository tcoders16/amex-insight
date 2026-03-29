/**
 * Session Context — RAM-backed MD file per chat session.
 *
 * Stores flagged facts from each conversation turn in Upstash Redis.
 * TTL: 2 hours. Deleted explicitly when user starts a new chat.
 *
 * Key format: amex:ctx:{sessionId}
 * Value: markdown string, e.g.:
 *   ## 2026-03-23
 *   **Q:** What was AMEX revenue in 2024?
 *   - Full year 2024 revenue net of interest expense was $17.2 billion.
 *   - Net income was $10.1 billion, up 23% year-over-year.
 */

import { Redis } from "@upstash/redis"

const PREFIX = "amex:ctx:"
const TTL    = 2 * 60 * 60  // 2 hours in seconds

function getRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

/** Load the full MD context string for a session. Returns "" if none. */
export async function getSessionContext(sessionId: string): Promise<string> {
  if (!sessionId) return ""
  const redis = getRedis()
  if (!redis) return ""
  try {
    const val = await redis.get<string>(`${PREFIX}${sessionId}`)
    return val ?? ""
  } catch {
    return ""
  }
}

/**
 * Append a new MD block to the session context.
 * Each block is a timestamped section with flagged facts.
 */
export async function appendSessionFact(sessionId: string, block: string): Promise<void> {
  if (!sessionId || !block.trim()) return
  const redis = getRedis()
  if (!redis) return
  try {
    const key      = `${PREFIX}${sessionId}`
    const existing = (await redis.get<string>(key)) ?? ""
    const updated  = existing ? `${existing}\n\n${block}` : block
    await redis.set(key, updated, { ex: TTL })
  } catch {
    // silently skip — never block chat response for context save failure
  }
}

/** Delete session context — called when user starts a new chat. */
export async function deleteSessionContext(sessionId: string): Promise<void> {
  if (!sessionId) return
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.del(`${PREFIX}${sessionId}`)
  } catch {
    // ignore
  }
}

/** Count how many facts are stored in the session context. */
export async function getSessionFactCount(sessionId: string): Promise<number> {
  const md = await getSessionContext(sessionId)
  if (!md) return 0
  return (md.match(/^- /gm) ?? []).length
}
