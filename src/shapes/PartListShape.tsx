import { chalkLinePath, hashString } from '../canvas/chalk'
import { pointInBounds } from '../canvas/geometry'
import { INK_COLOR } from '../canvas/blueprintTheme'
import type { BlueprintEditor } from '../canvas/editor'
import type { Bounds, PartListShape } from '../canvas/types'
import { escapeXml, type ShapeDef } from './shared'

const PAD_X = 16
const TITLE_H = 44
const ROW_H = 30
const PAD_BOTTOM = 14

function listHeight(items: string[]): number {
  return TITLE_H + Math.max(1, items.length) * ROW_H + PAD_BOTTOM
}

function bounds(shape: PartListShape): Bounds {
  return { x: 0, y: 0, w: shape.w, h: listHeight(shape.items) }
}

export const partListDef: ShapeDef<PartListShape> = {
  type: 'part-list',
  canEdit: true,
  getBounds: bounds,

  hitTest(shape, local) {
    return pointInBounds(local, bounds(shape))
  },

  Ink({ shape }) {
    const seed = hashString(shape.id)
    return (
      <path
        d={chalkLinePath(
          { x: PAD_X, y: TITLE_H - 8 },
          { x: shape.w - PAD_X, y: TITLE_H - 8 },
          seed + 3,
        )}
        style={{ fill: 'none', stroke: INK_COLOR }}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    )
  },

  Html({ shape, editor, editing }) {
    return <PartListBody shape={shape} editor={editor} editing={editing} />
  },

  toExportSvg(shape) {
    const seed = hashString(shape.id)
    const parts: string[] = [
      `<path d="${chalkLinePath({ x: PAD_X, y: TITLE_H - 8 }, { x: shape.w - PAD_X, y: TITLE_H - 8 }, seed + 3)}" fill="none" stroke="${INK_COLOR}" stroke-width="2.5" stroke-linecap="round"/>`,
      `<text x="${PAD_X}" y="30" font-family="Caveat, cursive" font-weight="700" font-size="28" fill="${INK_COLOR}">${escapeXml(shape.title)}</text>`,
    ]
    shape.items.forEach((item, i) => {
      const y = TITLE_H + 8 + i * ROW_H + 20
      parts.push(
        `<text x="${PAD_X}" y="${y}" font-family="Caveat, cursive" font-weight="500" font-size="22" fill="${INK_COLOR}">${i + 1}) ${escapeXml(item)}</text>`,
      )
    })
    return parts.join('')
  },
}

function PartListBody({
  shape,
  editor,
  editing,
}: {
  shape: PartListShape
  editor: BlueprintEditor
  editing: boolean
}) {
  const h = listHeight(shape.items)

  const update = (patch: Partial<PartListShape>) =>
    editor.updateShape(shape.id, patch, true)

  const setItem = (i: number, value: string) => {
    const items = shape.items.slice()
    items[i] = value
    update({ items })
  }
  const addItem = () => update({ items: [...shape.items, ''] })
  const removeItem = (i: number) =>
    update({ items: shape.items.filter((_, j) => j !== i) })

  const stop = (e: React.PointerEvent | React.TouchEvent) => e.stopPropagation()

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: shape.w,
        height: h,
        fontFamily: 'var(--font-hand)',
        color: INK_COLOR,
        padding: `8px ${PAD_X}px ${PAD_BOTTOM}px`,
        boxSizing: 'border-box',
        pointerEvents: editing ? 'all' : 'none',
        userSelect: 'none',
      }}
    >
      <input
        value={shape.title}
        readOnly={!editing}
        spellCheck={false}
        onPointerDown={editing ? stop : undefined}
        onChange={(e) => update({ title: e.target.value })}
        style={{
          ...fieldStyle,
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: '0.02em',
          height: TITLE_H - 12,
          textTransform: 'uppercase',
        }}
      />
      <div style={{ marginTop: 4 }}>
        {shape.items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', height: ROW_H }}>
            <span style={{ fontSize: 22, width: 22, flex: '0 0 auto', opacity: 0.95 }}>
              {i + 1})
            </span>
            <input
              value={item}
              readOnly={!editing}
              spellCheck={false}
              placeholder="item"
              onPointerDown={editing ? stop : undefined}
              onChange={(e) => setItem(i, e.target.value)}
              style={{ ...fieldStyle, fontSize: 22, flex: 1 }}
            />
            {editing && (
              <button
                aria-label={`Remove item ${i + 1}`}
                onPointerDown={stop}
                onClick={() => removeItem(i)}
                style={rowBtnStyle}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      {editing && (
        <button
          onPointerDown={stop}
          onClick={addItem}
          style={{ ...rowBtnStyle, width: 'auto', padding: '2px 8px', marginTop: 2 }}
        >
          + add row
        </button>
      )}
    </div>
  )
}

const fieldStyle: React.CSSProperties = {
  font: 'inherit',
  fontFamily: 'var(--font-hand)',
  fontWeight: 500,
  color: INK_COLOR,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  padding: 0,
  margin: 0,
  width: '100%',
  caretColor: INK_COLOR,
}

const rowBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: INK_COLOR,
  fontFamily: 'var(--font-sans)',
  fontSize: 16,
  lineHeight: 1,
  opacity: 0.7,
  cursor: 'pointer',
  flex: '0 0 auto',
  width: 22,
}
