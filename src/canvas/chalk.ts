/**
 * Shared "chalk" helpers for the custom shapes.
 *
 * Custom shapes get a subtle, *seeded* hand-drawn waver so straight edges
 * aren't mechanically perfect — but the seed is derived from the shape id, so
 * the jitter is stable across renders (it doesn't shimmer while you drag).
 */

/** Deterministic 0..1 PRNG (mulberry32) from a numeric seed. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Hash an arbitrary string (e.g. a shape id) into a 32-bit seed. */
export function hashString(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export interface Pt {
  x: number
  y: number
}

/**
 * Build an SVG path string for a slightly hand-drawn line between two points.
 * Inserts a few jittered waypoints; amplitude scales with length but is
 * clamped so long lines don't wander far. Deterministic given `seed`.
 */
export function chalkLinePath(a: Pt, b: Pt, seed: number, amp = 1.1): string {
  const rand = seededRandom(seed)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len // unit normal
  const ny = dx / len
  const segs = Math.max(2, Math.min(6, Math.round(len / 60)))
  const wobble = Math.min(amp, (len / 100) * amp + 0.5)

  let d = `M ${a.x.toFixed(2)} ${a.y.toFixed(2)}`
  for (let i = 1; i <= segs; i++) {
    const t = i / segs
    const px = a.x + dx * t
    const py = a.y + dy * t
    // Taper the wobble to zero at the endpoints so they stay anchored.
    const taper = Math.sin(t * Math.PI)
    const off = (rand() - 0.5) * 2 * wobble * taper
    d += ` L ${(px + nx * off).toFixed(2)} ${(py + ny * off).toFixed(2)}`
  }
  return d
}

/** A closed hand-drawn rectangle path (rounded-ish corners via jitter). */
export function chalkRectPath(
  w: number,
  h: number,
  seed: number,
  amp = 1.1,
): string {
  const tl: Pt = { x: 0, y: 0 }
  const tr: Pt = { x: w, y: 0 }
  const br: Pt = { x: w, y: h }
  const bl: Pt = { x: 0, y: h }
  return (
    chalkLinePath(tl, tr, seed + 1, amp) +
    chalkLinePath(tr, br, seed + 2, amp).replace('M', 'M') +
    chalkLinePath(br, bl, seed + 3, amp) +
    chalkLinePath(bl, tl, seed + 4, amp)
  )
}

/** Shared SVG props for chalk strokes. Width can be overridden per use. */
export const chalkStroke = {
  fill: 'none' as const,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}
