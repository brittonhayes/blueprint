import { getStrokePath } from '../canvas/freehand'
import { distToSegment } from '../canvas/geometry'
import { INK_COLOR } from '../canvas/blueprintTheme'
import type { Bounds, DrawShape, Vec } from '../canvas/types'
import type { ShapeDef } from './shared'

function bounds(shape: DrawShape): Bounds {
  const pad = shape.size / 2 + 1
  if (shape.points.length === 0) return { x: -pad, y: -pad, w: pad * 2, h: pad * 2 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of shape.points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  }
}

export const drawDef: ShapeDef<DrawShape> = {
  type: 'draw',
  canEdit: false,
  getBounds: bounds,

  hitTest(shape, local: Vec) {
    const tol = shape.size / 2 + 4
    const pts = shape.points
    if (pts.length === 1) return Math.hypot(local.x - pts[0].x, local.y - pts[0].y) <= tol
    for (let i = 1; i < pts.length; i++) {
      if (distToSegment(local, pts[i - 1], pts[i]) <= tol) return true
    }
    return false
  },

  Ink({ shape }) {
    return <path d={getStrokePath(shape.points, { size: shape.size })} fill={INK_COLOR} />
  },

  toExportSvg(shape) {
    return `<path d="${getStrokePath(shape.points, { size: shape.size })}" fill="${INK_COLOR}"/>`
  },
}
