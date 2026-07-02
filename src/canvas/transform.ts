import { getShapeDef } from '../shapes'
import type { Bounds, Shape, Vec } from './types'

/**
 * Every shape carries an optional rotation (radians) and uniform scale, both
 * applied about the centre of its local bounds. These helpers are the single
 * source of truth for that transform: rendering, hit-testing, selection
 * handles, and PNG export all map points through them, so a shape type only
 * ever thinks in its own untransformed local space.
 */

export const MIN_SHAPE_SCALE = 0.2
export const MAX_SHAPE_SCALE = 8

export function getRotation(shape: Shape): number {
  return shape.rotation ?? 0
}

export function getScale(shape: Shape): number {
  return shape.scale ?? 1
}

export function clampScale(scale: number): number {
  return Math.max(MIN_SHAPE_SCALE, Math.min(MAX_SHAPE_SCALE, scale))
}

/** Centre of the shape's local bounds — the pivot for rotation and scaling. */
export function getLocalCenter(shape: Shape): Vec {
  const b = getShapeDef(shape.type).getBounds(shape)
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 }
}

/** World position of the rotation/scale pivot. */
export function getWorldCenter(shape: Shape): Vec {
  const c = getLocalCenter(shape)
  return { x: shape.x + c.x, y: shape.y + c.y }
}

/** Map a shape-local point to world space through the full transform. */
export function shapeLocalToWorld(shape: Shape, local: Vec): Vec {
  const c = getLocalCenter(shape)
  const r = getRotation(shape)
  const k = getScale(shape)
  const dx = (local.x - c.x) * k
  const dy = (local.y - c.y) * k
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  return {
    x: shape.x + c.x + dx * cos - dy * sin,
    y: shape.y + c.y + dx * sin + dy * cos,
  }
}

/** Map a world point into shape-local space (inverse of shapeLocalToWorld). */
export function worldToShapeLocal(shape: Shape, world: Vec): Vec {
  const c = getLocalCenter(shape)
  const r = getRotation(shape)
  const k = getScale(shape)
  const dx = world.x - shape.x - c.x
  const dy = world.y - shape.y - c.y
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  return {
    x: c.x + (dx * cos + dy * sin) / k,
    y: c.y + (-dx * sin + dy * cos) / k,
  }
}

/**
 * The shape's local bounds corners mapped to world space, in order:
 * top-left, top-right, bottom-right, bottom-left.
 */
export function getWorldCorners(shape: Shape): [Vec, Vec, Vec, Vec] {
  const b = getShapeDef(shape.type).getBounds(shape)
  return [
    shapeLocalToWorld(shape, { x: b.x, y: b.y }),
    shapeLocalToWorld(shape, { x: b.x + b.w, y: b.y }),
    shapeLocalToWorld(shape, { x: b.x + b.w, y: b.y + b.h }),
    shapeLocalToWorld(shape, { x: b.x, y: b.y + b.h }),
  ]
}

/** Axis-aligned world bounds enclosing the transformed shape. */
export function getWorldAABB(shape: Shape): Bounds {
  const pts = getWorldCorners(shape)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/**
 * Axis-aligned world bounds enclosing a set of shapes — the bounding box the
 * multi-selection UI (outline + group rotate/scale grips) is drawn around.
 */
export function getGroupWorldAABB(shapes: Shape[]): Bounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const s of shapes) {
    const b = getWorldAABB(s)
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.w)
    maxY = Math.max(maxY, b.y + b.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/**
 * An oriented bounding box for a multi-selection. Unlike a shape it has no
 * document identity — it's transient UI state that the group move/rotate/scale
 * gestures carry so the selection frame turns with its contents instead of
 * snapping back to an axis-aligned box. `hw`/`hh` are half-extents in the
 * frame's own (unrotated) space; `cx`/`cy` is its centre in world space.
 */
export interface GroupFrame {
  cx: number
  cy: number
  hw: number
  hh: number
  rotation: number
}

/** Seed an axis-aligned frame from a group's world bounding box. */
export function aabbToFrame(b: Bounds): GroupFrame {
  return { cx: b.x + b.w / 2, cy: b.y + b.h / 2, hw: b.w / 2, hh: b.h / 2, rotation: 0 }
}

/** Map a frame-local point (relative to its centre) into world space. */
function framePoint(f: GroupFrame, lx: number, ly: number): Vec {
  const cos = Math.cos(f.rotation)
  const sin = Math.sin(f.rotation)
  return { x: f.cx + lx * cos - ly * sin, y: f.cy + lx * sin + ly * cos }
}

/** The frame's corners in world space: top-left, top-right, bottom-right, bottom-left. */
export function getFrameCorners(f: GroupFrame): [Vec, Vec, Vec, Vec] {
  return [
    framePoint(f, -f.hw, -f.hh),
    framePoint(f, f.hw, -f.hh),
    framePoint(f, f.hw, f.hh),
    framePoint(f, -f.hw, f.hh),
  ]
}

/** Rotate grip: `offset` world px past the frame's (rotated) top-edge midpoint. */
export function getFrameRotateGrip(f: GroupFrame, offset: number): Vec {
  const tm = framePoint(f, 0, -f.hh)
  const d = Math.hypot(tm.x - f.cx, tm.y - f.cy) || 1
  const t = (d + offset) / d
  return { x: f.cx + (tm.x - f.cx) * t, y: f.cy + (tm.y - f.cy) * t }
}

/** Scale grip: the frame's (rotated) bottom-right corner. */
export function getFrameScaleGrip(f: GroupFrame): Vec {
  return framePoint(f, f.hw, f.hh)
}

/** Rotate a world point around a pivot by `angle` radians. */
export function rotateAround(p: Vec, pivot: Vec, angle: number): Vec {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = p.x - pivot.x
  const dy = p.y - pivot.y
  return {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dy * cos + dx * sin,
  }
}

/** Do two axis-aligned boxes overlap (touching counts)? */
export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return (
    a.x <= b.x + b.w &&
    a.x + a.w >= b.x &&
    a.y <= b.y + b.h &&
    a.y + a.h >= b.y
  )
}

/**
 * World position of the rotate grip: past the top edge midpoint, `offset`
 * world px beyond the bounds along the shape's (rotated) up direction.
 */
export function getRotateHandleWorld(shape: Shape, offset: number): Vec {
  const [tl, tr] = getWorldCorners(shape)
  const topMid = { x: (tl.x + tr.x) / 2, y: (tl.y + tr.y) / 2 }
  const c = getWorldCenter(shape)
  const d = Math.hypot(topMid.x - c.x, topMid.y - c.y) || 1
  const t = (d + offset) / d
  return { x: c.x + (topMid.x - c.x) * t, y: c.y + (topMid.y - c.y) * t }
}

/** World position of the scale grip: the bottom-right bounds corner. */
export function getScaleHandleWorld(shape: Shape): Vec {
  return getWorldCorners(shape)[2]
}

/** CSS transform placing a shape's local space into the world layer. */
export function shapeCssTransform(shape: Shape): string {
  const r = getRotation(shape)
  const k = getScale(shape)
  if (r === 0 && k === 1) return `translate(${shape.x}px, ${shape.y}px)`
  const c = getLocalCenter(shape)
  return (
    `translate(${shape.x + c.x}px, ${shape.y + c.y}px) ` +
    `rotate(${r}rad) scale(${k}) translate(${-c.x}px, ${-c.y}px)`
  )
}

/** SVG transform attribute for export, relative to a plate origin (x0, y0). */
export function shapeSvgTransform(shape: Shape, x0: number, y0: number): string {
  const r = getRotation(shape)
  const k = getScale(shape)
  const c = getLocalCenter(shape)
  const deg = (r * 180) / Math.PI
  return (
    `translate(${(shape.x - x0 + c.x).toFixed(2)} ${(shape.y - y0 + c.y).toFixed(2)}) ` +
    `rotate(${deg.toFixed(3)}) scale(${k.toFixed(4)}) ` +
    `translate(${(-c.x).toFixed(2)} ${(-c.y).toFixed(2)})`
  )
}
