import type { Bounds, Camera, Vec } from './types'

/** Screen point for a world point under the given camera. */
export function worldToScreen(p: Vec, cam: Camera): Vec {
  return { x: (p.x + cam.x) * cam.z, y: (p.y + cam.y) * cam.z }
}

/** World point for a screen point under the given camera. */
export function screenToWorld(p: Vec, cam: Camera): Vec {
  return { x: p.x / cam.z - cam.x, y: p.y / cam.z - cam.y }
}

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Shortest distance from point p to the segment a→b. */
export function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return dist(p, a)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

export function pointInBounds(p: Vec, b: Bounds, pad = 0): boolean {
  return (
    p.x >= b.x - pad &&
    p.x <= b.x + b.w + pad &&
    p.y >= b.y - pad &&
    p.y <= b.y + b.h + pad
  )
}

/** Grow a bounds by a uniform margin. */
export function expandBounds(b: Bounds, m: number): Bounds {
  return { x: b.x - m, y: b.y - m, w: b.w + m * 2, h: b.h + m * 2 }
}

/** Union of a list of bounds (empty → null). */
export function unionBounds(list: Bounds[]): Bounds | null {
  if (list.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const b of list) {
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.w)
    maxY = Math.max(maxY, b.y + b.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}
