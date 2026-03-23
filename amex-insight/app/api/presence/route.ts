/**
 * Presence API — returns live visitor count.
 *
 * Uses a seeded counter based on current time window so the number is
 * consistent across instances (no Redis needed) yet changes naturally.
 * A realistic base + noise gives 3–9 concurrent visitors for a demo platform.
 */

export const runtime = "edge"

// Deterministic noise: same seed → same value within a 2-minute window
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

export async function GET() {
  // Window: changes every 2 minutes
  const window = Math.floor(Date.now() / (2 * 60 * 1000))

  // Base between 4–8, shifts per window
  const base  = 4 + Math.floor(seededRandom(window * 7919) * 5)
  // Noise ±1 per sub-window (30s)
  const sub   = Math.floor(Date.now() / (30 * 1000))
  const noise = Math.floor(seededRandom(sub * 6271) * 3) - 1
  const count = Math.max(2, base + noise)

  return Response.json({ count, updatedAt: Date.now() })
}
