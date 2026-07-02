import { hashString } from '../canvas/chalk'
import { INK_COLOR } from '../canvas/blueprintTheme'
import { pointInBounds } from '../canvas/geometry'
import { getStencilDef, stencilInkOps, type InkOp } from '../stencils/catalog'
import type { Bounds, StencilShape, Vec } from '../canvas/types'
import { escapeXml, type ShapeDef } from './shared'

function defFor(shape: StencilShape) {
  return getStencilDef(shape.kind)
}

// Sizing lives in the universal shape transform; local bounds are unscaled.
function bounds(shape: StencilShape): Bounds {
  const def = defFor(shape)
  if (!def) return { x: 0, y: 0, w: 40, h: 40 }
  // Tilted parts (stamps) poke slightly past their nominal box.
  const pad = def.tilt ? 12 : 4
  return { x: -pad, y: -pad, w: def.w + pad * 2, h: def.h + pad * 2 }
}

/** Font stack for hand-lettered stencil text (must match EditableText). */
const HAND = "Caveat, 'Comic Sans MS', cursive"

function opToSvg(op: InkOp): string {
  if (op.t === 'stroke') {
    return (
      `<path d="${op.d}" fill="none" stroke="${INK_COLOR}" stroke-width="${op.width}" ` +
      `stroke-linecap="round" stroke-linejoin="round"/>`
    )
  }
  if (op.t === 'fill') return `<path d="${op.d}" fill="${INK_COLOR}"/>`
  return (
    `<text x="${op.x}" y="${op.y}" text-anchor="middle" font-family="${HAND}" ` +
    `font-weight="${op.bold ? 700 : 500}" font-size="${op.size}" ` +
    `letter-spacing="2" fill="${INK_COLOR}">${escapeXml(op.text)}</text>`
  )
}

export const stencilDef: ShapeDef<StencilShape> = {
  type: 'stencil',
  canEdit: false,
  getBounds: bounds,

  hitTest(shape, local: Vec) {
    return pointInBounds(local, bounds(shape))
  },

  Ink({ shape }) {
    const def = defFor(shape)
    if (!def) return null
    const ops = stencilInkOps(def, hashString(shape.id))
    const tilt = def.tilt
      ? `rotate(${def.tilt} ${def.w / 2} ${def.h / 2})`
      : undefined
    return (
      <g transform={tilt}>
        {ops.map((op, i) =>
          op.t === 'text' ? (
            <text
              key={i}
              x={op.x}
              y={op.y}
              textAnchor="middle"
              fontFamily={HAND}
              fontWeight={op.bold ? 700 : 500}
              fontSize={op.size}
              letterSpacing={2}
              fill={INK_COLOR}
            >
              {op.text}
            </text>
          ) : (
            <path
              key={i}
              d={op.d}
              fill={op.t === 'fill' ? INK_COLOR : 'none'}
              stroke={op.t === 'stroke' ? INK_COLOR : 'none'}
              strokeWidth={op.t === 'stroke' ? op.width : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ),
        )}
      </g>
    )
  },

  toExportSvg(shape) {
    const def = defFor(shape)
    if (!def) return ''
    const ops = stencilInkOps(def, hashString(shape.id))
    const tilt = def.tilt
      ? ` transform="rotate(${def.tilt} ${def.w / 2} ${def.h / 2})"`
      : ''
    return `<g${tilt}>` + ops.map(opToSvg).join('') + `</g>`
  },
}
