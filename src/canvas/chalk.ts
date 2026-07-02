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

/** A hand-drawn polyline through the given points (optionally closed). */
export function chalkPolyPath(
  pts: Pt[],
  seed: number,
  closed = false,
  amp = 1.1,
): string {
  let d = ''
  for (let i = 1; i < pts.length; i++) {
    d += chalkLinePath(pts[i - 1], pts[i], seed + i, amp)
  }
  if (closed && pts.length > 2) {
    d += chalkLinePath(pts[pts.length - 1], pts[0], seed + pts.length, amp)
  }
  return d
}

/** A closed hand-drawn ellipse: a jittered ring smoothed with quadratics. */
export function chalkEllipsePath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  amp = 1.4,
): string {
  const rand = seededRandom(seed)
  const n = Math.max(10, Math.round((rx + ry) / 5))
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const j = (rand() - 0.5) * 2 * amp
    pts.push({ x: cx + Math.cos(a) * (rx + j), y: cy + Math.sin(a) * (ry + j) })
  }
  // Smooth closed ring via quadratic midpoints.
  const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  const first = mid(pts[n - 1], pts[0])
  let d = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`
  for (let i = 0; i < n; i++) {
    const cur = pts[i]
    const m = mid(cur, pts[(i + 1) % n])
    d += ` Q ${cur.x.toFixed(2)} ${cur.y.toFixed(2)} ${m.x.toFixed(2)} ${m.y.toFixed(2)}`
  }
  return d + ' Z'
}

export function chalkCirclePath(
  cx: number,
  cy: number,
  r: number,
  seed: number,
  amp = 1.4,
): string {
  return chalkEllipsePath(cx, cy, r, r, seed, amp)
}

/**
 * A hand-drawn open elliptical arc from angle `a0` to `a1` (radians,
 * clockwise-positive in screen space). Endpoints stay anchored; jitter tapers
 * to zero at both ends like {@link chalkLinePath}.
 */
export function chalkArcPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  a0: number,
  a1: number,
  seed: number,
  amp = 1.2,
): string {
  const rand = seededRandom(seed)
  const sweep = a1 - a0
  const n = Math.max(6, Math.round((Math.abs(sweep) * (rx + ry)) / 14))
  let d = ''
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const a = a0 + sweep * t
    const taper = Math.sin(t * Math.PI)
    const j = (rand() - 0.5) * 2 * amp * taper
    const x = cx + Math.cos(a) * (rx + j)
    const y = cy + Math.sin(a) * (ry + j)
    d += `${i === 0 ? 'M' : ' L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }
  return d
}

/** Shared SVG props for chalk strokes. Width can be overridden per use. */
export const chalkStroke = {
  fill: 'none' as const,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}
