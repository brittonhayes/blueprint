import { measureText } from '../canvas/textMeasure'
import { INK_COLOR } from '../canvas/blueprintTheme'
import type { Bounds, TextShape } from '../canvas/types'
import { EditableText } from './EditableText'
import { escapeXml, type ShapeDef } from './shared'

const PAD = 6

function bounds(shape: TextShape): Bounds {
  const { w, h } = measureText(shape.text || 'Text', shape.fontSize)
  return { x: -PAD, y: -PAD, w: w + PAD * 2, h: h + PAD * 2 }
}

export const textDef: ShapeDef<TextShape> = {
  type: 'text',
  canEdit: true,
  getBounds: bounds,

  hitTest(shape, local) {
    const b = bounds(shape)
    return (
      local.x >= b.x &&
      local.x <= b.x + b.w &&
      local.y >= b.y &&
      local.y <= b.y + b.h
    )
  },

  Html({ shape, editor, editing }) {
    const { w, h } = measureText(shape.text || 'Text', shape.fontSize)
    return (
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          minWidth: 24,
          width: Math.max(24, w) + 4,
          height: h,
        }}
      >
        <EditableText
          value={shape.text}
          placeholder="Text"
          editing={editing}
          align="left"
          multiline
          fontSize={shape.fontSize}
          onChange={(text) => editor.updateShape(shape.id, { text }, true)}
          onCommit={() => editor.setEditingShape(null)}
        />
      </div>
    )
  },

  toExportSvg(shape) {
    const lines = shape.text.split('\n')
    const size = shape.fontSize
    return lines
      .map(
        (line, i) =>
          `<text x="0" y="${(i * size * 1.15 + size * 0.9).toFixed(1)}" ` +
          `font-family="Caveat, cursive" font-weight="500" font-size="${size}" ` +
          `fill="${INK_COLOR}">${escapeXml(line)}</text>`,
      )
      .join('')
  },
}
