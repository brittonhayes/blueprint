import { chalkLinePath, hashString } from '../canvas/chalk'
import { distToSegment } from '../canvas/geometry'
import { INK_COLOR } from '../canvas/blueprintTheme'
import type { Bounds, DimensionLineShape, Handle, Vec } from '../canvas/types'
import { EditableText } from './EditableText'
import { escapeXml, type ShapeDef } from './shared'

const STROKE = 2.5
const TICK = 9

/** Perpendicular unit normal + upright label angle for a dimension line. */
function geom(x2: number, y2: number) {
  const len = Math.hypot(x2, y2) || 1
  const nx = -y2 / len
  const ny = x2 / len
  let angle = (Math.atan2(y2, x2) * 180) / Math.PI
  if (angle > 90) angle -= 180
  if (angle < -90) angle += 180
  return { nx, ny, angle, midX: x2 / 2, midY: y2 / 2 }
}

function tickPath(cx: number, cy: number, nx: number, ny: number): string {
  return (
    `M ${(cx + nx * TICK).toFixed(2)} ${(cy + ny * TICK).toFixed(2)} ` +
    `L ${(cx - nx * TICK).toFixed(2)} ${(cy - ny * TICK).toFixed(2)}`
  )
}

function bounds(shape: DimensionLineShape): Bounds {
  const { x2, y2 } = shape
  const minX = Math.min(0, x2) - TICK - 20
  const minY = Math.min(0, y2) - TICK - 30
  const maxX = Math.max(0, x2) + TICK + 20
  const maxY = Math.max(0, y2) + TICK + 20
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export const dimensionLineDef: ShapeDef<DimensionLineShape> = {
  type: 'dimension-line',
  canEdit: true,
  getBounds: bounds,

  hitTest(shape, local: Vec) {
    return distToSegment(local, { x: 0, y: 0 }, { x: shape.x2, y: shape.y2 }) <= 8
  },

  getHandles(shape): Handle[] {
    return [
      { id: 'start', x: 0, y: 0 },
      { id: 'end', x: shape.x2, y: shape.y2 },
    ]
  },

  onHandleDrag(shape, handleId, local) {
    if (handleId === 'end') return { x2: local.x, y2: local.y }
    // Dragging the start moves the origin and keeps the end anchored. The
    // origin shift is a local-space delta, so push it through the shape's
    // rotation/scale to get the world-space translation.
    const r = shape.rotation ?? 0
    const k = shape.scale ?? 1
    const cos = Math.cos(r)
    const sin = Math.sin(r)
    return {
      x: shape.x + (local.x * cos - local.y * sin) * k,
      y: shape.y + (local.x * sin + local.y * cos) * k,
      x2: shape.x2 - local.x,
      y2: shape.y2 - local.y,
    }
  },

  Ink({ shape }) {
    const { x2, y2 } = shape
    const seed = hashString(shape.id)
    const { nx, ny } = geom(x2, y2)
    const stroke = { fill: 'none', stroke: INK_COLOR }
    return (
      <>
        <path d={chalkLinePath({ x: 0, y: 0 }, { x: x2, y: y2 }, seed)} style={stroke} strokeWidth={STROKE} strokeLinecap="round" />
        <path d={tickPath(0, 0, nx, ny)} style={stroke} strokeWidth={STROKE} strokeLinecap="round" />
        <path d={tickPath(x2, y2, nx, ny)} style={stroke} strokeWidth={STROKE} strokeLinecap="round" />
      </>
    )
  },

  Html({ shape, editor, editing }) {
    const { angle, midX, midY } = geom(shape.x2, shape.y2)
    return (
      <div
        style={{
          position: 'absolute',
          left: midX,
          top: midY,
          transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-14px)`,
          transformOrigin: 'center',
          whiteSpace: 'nowrap',
          padding: '0 6px',
          minWidth: 40,
        }}
      >
        <EditableText
          value={shape.label}
          placeholder="16 FEET"
          editing={editing}
          fontSize={22}
          onChange={(label) => editor.updateShape(shape.id, { label }, true)}
          onCommit={() => editor.setEditingShape(null)}
        />
      </div>
    )
  },

  toExportSvg(shape) {
    const { x2, y2, label } = shape
    const seed = hashString(shape.id)
    const { nx, ny, angle, midX, midY } = geom(x2, y2)
    const s = `fill="none" stroke="${INK_COLOR}" stroke-width="${STROKE}" stroke-linecap="round"`
    const labelY = midY - 22
    return (
      `<path d="${chalkLinePath({ x: 0, y: 0 }, { x: x2, y: y2 }, seed)}" ${s}/>` +
      `<path d="${tickPath(0, 0, nx, ny)}" ${s}/>` +
      `<path d="${tickPath(x2, y2, nx, ny)}" ${s}/>` +
      `<text x="${midX.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" ` +
      `transform="rotate(${angle.toFixed(2)} ${midX.toFixed(1)} ${labelY.toFixed(1)})" ` +
      `font-family="Caveat, cursive" font-weight="500" font-size="22" fill="${INK_COLOR}">${escapeXml(label)}</text>`
    )
  },
}
