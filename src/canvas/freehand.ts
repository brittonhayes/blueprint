import type { StrokePoint } from './types'

/**
 * A small pressure-aware freehand engine.
 *
 * Given the raw pointer samples of a stroke, it produces a filled outline
 * polygon (as an SVG path string) whose width tracks pen pressure — so the
 * silver sharpie tapers and swells like a real marker instead of reading as a
 * mechanical constant-width line. Self-contained: no drawing SDK required.
 *
 * Pipeline: streamline (exponential smoothing) → offset each point left/right
 * by a pressure-scaled radius → stitch the two edges into one closed polygon
 * with rounded end caps → emit a smoothed SVG path.
 */

/** Taper length at the stroke tips, relative to the nib size. */
export const TAPER_RATIO = 1.6

interface Options {
  /** Nominal stroke diameter in px. */
  size?: number
  /** How strongly pressure thins the stroke (0 = constant width). */
  thinning?: number
  /** Smoothing factor for the input samples (0..1). */
  streamline?: number
  /** Taper length at each tip in px (0 = blunt caps). */
  taper?: number
}

interface P {
  x: number
  y: number
  p: number
}

/** Exponential smoothing of the raw samples toward a cleaner path. */
function streamline(points: P[], factor: number): P[] {
  if (points.length < 2) return points.slice()
  const out: P[] = [points[0]]
  const k = 1 - factor
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1]
    const cur = points[i]
    out.push({
      x: prev.x + (cur.x - prev.x) * k,
      y: prev.y + (cur.y - prev.y) * k,
      p: prev.p + (cur.p - prev.p) * k,
    })
  }
  return out
}

/** Drop samples closer than `min` px so the outline math stays stable. */
function dedupe(points: P[], min = 1): P[] {
  if (points.length === 0) return points
  const out: P[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const last = out[out.length - 1]
    if (Math.hypot(points[i].x - last.x, points[i].y - last.y) >= min) {
      out.push(points[i])
    }
  }
  // Always keep the final sample so short flicks still register.
  const last = points[points.length - 1]
  if (out[out.length - 1] !== last) out.push(last)
  return out
}

function circlePath(cx: number, cy: number, r: number): string {
  return (
    `M ${(cx - r).toFixed(2)} ${cy.toFixed(2)} ` +
    `a ${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(r * 2).toFixed(2)} 0 ` +
    `a ${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(-r * 2).toFixed(2)} 0 z`
  )
}

/** Build a smoothed SVG fill path for a freehand stroke. */
export function getStrokePath(
  raw: StrokePoint[],
  { size = 6, thinning = 0.55, streamline: sl = 0.5, taper = 0 }: Options = {},
): string {
  const input = dedupe(raw.map((pt) => ({ x: pt.x, y: pt.y, p: pt.p })))
  if (input.length === 0) return ''

  const radius = (pressure: number) => {
    const clamped = pressure > 0 ? pressure : 0.5
    // Blend a constant floor with the pressure-scaled part.
    const t = 1 - thinning + thinning * clamped
    return Math.max(0.5, (size / 2) * t)
  }

  // A single tap becomes a dot.
  if (input.length === 1) {
    return circlePath(input[0].x, input[0].y, radius(input[0].p))
  }

  const pts = streamline(input, sl)

  // Cumulative arc length per point, so the tips can taper by distance
  // travelled rather than by sample count (samples cluster when moving slowly).
  const arc: number[] = [0]
  for (let i = 1; i < pts.length; i++) {
    arc.push(arc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  }
  const total = arc[arc.length - 1]
  // A stroke shorter than both tapers combined still deserves a visible body.
  const tip = Math.min(taper, total / 2.5)
  const taperScale = (d: number) => {
    if (tip <= 0) return 1
    const t = Math.min(1, Math.min(d, total - d) / tip)
    // Ease-out so the tip comes to a marker-like point, not a cone.
    return 0.12 + 0.88 * Math.sin((t * Math.PI) / 2)
  }

  const left: [number, number][] = []
  const right: [number, number][] = []

  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i]
    const prev = pts[i - 1] ?? cur
    const next = pts[i + 1] ?? cur
    let dx = next.x - prev.x
    let dy = next.y - prev.y
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len
    // Left normal.
    const nx = -dy
    const ny = dx
    const r = radius(cur.p) * taperScale(arc[i])
    left.push([cur.x + nx * r, cur.y + ny * r])
    right.push([cur.x - nx * r, cur.y - ny * r])
  }

  // Outline: forward along the left edge, back along the right edge.
  const outline = left.concat(right.reverse())
  return smoothClosedPath(outline)
}

/** A closed path through the points, rounded via quadratic midpoints. */
function smoothClosedPath(points: [number, number][]): string {
  if (points.length < 3) {
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`)
      .join(' ')
  }
  const mid = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ]
  let d = ''
  const first = mid(points[points.length - 1], points[0])
  d += `M ${first[0].toFixed(2)} ${first[1].toFixed(2)} `
  for (let i = 0; i < points.length; i++) {
    const cur = points[i]
    const next = points[(i + 1) % points.length]
    const m = mid(cur, next)
    d += `Q ${cur[0].toFixed(2)} ${cur[1].toFixed(2)} ${m[0].toFixed(2)} ${m[1].toFixed(2)} `
  }
  return d + 'Z'
}
