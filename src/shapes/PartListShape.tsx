import {
  ShapeUtil,
  SVGContainer,
  HTMLContainer,
  Rectangle2d,
  useEditor,
  useValue,
  T,
  type TLBaseShape,
  type RecordProps,
} from 'tldraw'
import { INK_COLOR } from '../canvas/blueprintTheme'
import { chalkLinePath, hashString } from '../canvas/chalk'

export type PartListShape = TLBaseShape<
  'part-list',
  { w: number; title: string; items: string[] }
>

const PAD_X = 16
const TITLE_H = 44
const ROW_H = 30
const PAD_BOTTOM = 14

function listHeight(items: string[]): number {
  return TITLE_H + Math.max(1, items.length) * ROW_H + PAD_BOTTOM
}

/**
 * A titled parts block with an auto-numbering hand-lettered list — mirroring
 * the "SOLDIERS" breakdown on the Breakstep plate. Rows add/remove inline
 * while the shape is being edited.
 */
export class PartListShapeUtil extends ShapeUtil<PartListShape> {
  static override type = 'part-list' as const
  static override props: RecordProps<PartListShape> = {
    w: T.number,
    title: T.string,
    items: T.arrayOf(T.string),
  }

  getDefaultProps(): PartListShape['props'] {
    return {
      w: 260,
      title: 'SOLDIERS',
      items: ['Boots', 'Actuators', 'Solenoids', 'Switch on timer'],
    }
  }

  override canEdit() {
    return true
  }
  override hideRotateHandle() {
    return true
  }
  override canResize() {
    return false
  }

  getGeometry(shape: PartListShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: listHeight(shape.props.items),
      isFilled: true,
    })
  }

  component(shape: PartListShape) {
    const { w, items } = shape.props
    const h = listHeight(items)
    const seed = hashString(shape.id)
    return (
      <>
        <SVGContainer>
          {/* title underline */}
          <path
            d={chalkLinePath(
              { x: PAD_X, y: TITLE_H - 8 },
              { x: w - PAD_X, y: TITLE_H - 8 },
              seed + 3,
            )}
            style={{ fill: 'none', stroke: INK_COLOR }}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </SVGContainer>
        <HTMLContainer>
          <PartListBody shape={shape} w={w} h={h} />
        </HTMLContainer>
      </>
    )
  }

  getIndicatorPath(shape: PartListShape) {
    const p = new Path2D()
    p.rect(0, 0, shape.props.w, listHeight(shape.props.items))
    return p
  }
}

function PartListBody({
  shape,
  w,
  h,
}: {
  shape: PartListShape
  w: number
  h: number
}) {
  const editor = useEditor()
  const editing = useValue(
    'editing',
    () => editor.getEditingShapeId() === shape.id,
    [editor, shape.id],
  )

  const update = (props: Partial<PartListShape['props']>) =>
    editor.updateShape<PartListShape>({
      id: shape.id,
      type: 'part-list',
      props,
    })

  const setItem = (i: number, value: string) => {
    const items = shape.props.items.slice()
    items[i] = value
    update({ items })
  }
  const addItem = () => update({ items: [...shape.props.items, ''] })
  const removeItem = (i: number) =>
    update({ items: shape.props.items.filter((_, j) => j !== i) })

  const stop = (e: React.PointerEvent | React.TouchEvent) => e.stopPropagation()

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: w,
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
        value={shape.props.title}
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
        {shape.props.items.map((item, i) => (
          <div
            key={i}
            style={{ display: 'flex', alignItems: 'center', height: ROW_H }}
          >
            <span
              style={{ fontSize: 22, width: 22, flex: '0 0 auto', opacity: 0.95 }}
            >
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
