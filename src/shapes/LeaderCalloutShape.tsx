import { chalkLinePath, hashString } from '../canvas/chalk'
import { distToSegment, pointInBounds } from '../canvas/geometry'
import { INK_COLOR } from '../canvas/blueprintTheme'
import type { Bounds, Handle, LeaderCalloutShape, Vec } from '../canvas/types'
import { EditableText } from './EditableText'
import { escapeXml, type ShapeDef } from './shared'

const STROKE = 2.5

function arrowhead(w: number, h: number, tx: number, ty: number) {
  const ang = Math.atan2(ty - h, tx - w)
  const a = 0.45
  const headLen = 11
  return {
    ah1: { x: tx - headLen * Math.cos(ang - a), y: ty - headLen * Math.sin(ang - a) },
    ah2: { x: tx - headLen * Math.cos(ang + a), y: ty - headLen * Math.sin(ang + a) },
  }
}

function bounds(shape: LeaderCalloutShape): Bounds {
  const { w, h, tx, ty } = shape
  const minX = Math.min(0, tx) - 4
  const minY = Math.min(0, ty) - 4
  const maxX = Math.max(w, tx) + 4
  const maxY = Math.max(h, ty) + 4
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export const leaderCalloutDef: ShapeDef<LeaderCalloutShape> = {
  type: 'leader-callout',
  canEdit: true,
  getBounds: bounds,

  hitTest(shape, local: Vec) {
    const { w, h, tx, ty } = shape
    if (pointInBounds(local, { x: 0, y: 0, w, h })) return true
    return distToSegment(local, { x: w, y: h }, { x: tx, y: ty }) <= 8
  },

  getHandles(shape): Handle[] {
    return [{ id: 'target', x: shape.tx, y: shape.ty }]
  },

  onHandleDrag(_shape, _handleId, local) {
    return { tx: local.x, ty: local.y }
  },

  Ink({ shape }) {
    const { w, h, tx, ty } = shape
    const seed = hashString(shape.id)
    const { ah1, ah2 } = arrowhead(w, h, tx, ty)
    const s = { fill: 'none', stroke: INK_COLOR }
    return (
      <>
        <path d={chalkLinePath({ x: 0, y: h }, { x: w, y: h }, seed + 5)} style={s} strokeWidth={STROKE} strokeLinecap="round" />
        <path d={chalkLinePath({ x: w, y: h }, { x: tx, y: ty }, seed + 9)} style={s} strokeWidth={STROKE} strokeLinecap="round" />
        <path
          d={`M ${ah1.x.toFixed(2)} ${ah1.y.toFixed(2)} L ${tx.toFixed(2)} ${ty.toFixed(2)} L ${ah2.x.toFixed(2)} ${ah2.y.toFixed(2)}`}
          style={s}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    )
  },

  Html({ shape, editor, editing }) {
    const { w, h } = shape
    return (
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: w,
          height: h,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '0 4px',
          boxSizing: 'border-box',
        }}
      >
        <EditableText
          value={shape.label}
          placeholder="LABEL"
          editing={editing}
          align="left"
          fontSize={22}
          onChange={(label) => editor.updateShape(shape.id, { label }, true)}
          onCommit={() => editor.setEditingShape(null)}
        />
      </div>
    )
  },

  toExportSvg(shape) {
    const { w, h, tx, ty, label } = shape
    const seed = hashString(shape.id)
    const { ah1, ah2 } = arrowhead(w, h, tx, ty)
    const s = `fill="none" stroke="${INK_COLOR}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"`
    return (
      `<path d="${chalkLinePath({ x: 0, y: h }, { x: w, y: h }, seed + 5)}" ${s}/>` +
      `<path d="${chalkLinePath({ x: w, y: h }, { x: tx, y: ty }, seed + 9)}" ${s}/>` +
      `<path d="M ${ah1.x.toFixed(2)} ${ah1.y.toFixed(2)} L ${tx.toFixed(2)} ${ty.toFixed(2)} L ${ah2.x.toFixed(2)} ${ah2.y.toFixed(2)}" ${s}/>` +
      `<text x="4" y="${(h - 8).toFixed(1)}" font-family="Caveat, cursive" font-weight="500" font-size="22" fill="${INK_COLOR}">${escapeXml(label)}</text>`
    )
  },
}
