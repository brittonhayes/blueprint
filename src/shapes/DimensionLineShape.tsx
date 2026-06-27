import {
  ShapeUtil,
  SVGContainer,
  HTMLContainer,
  Edge2d,
  Vec,
  T,
  type TLBaseShape,
  type TLHandle,
  type TLHandleDragInfo,
  type RecordProps,
  type IndexKey,
} from 'tldraw'
import { INK_COLOR } from '../canvas/blueprintTheme'
import { chalkLinePath, hashString } from '../canvas/chalk'
import { EditableText } from './EditableText'

export type DimensionLineShape = TLBaseShape<
  'dimension-line',
  { x2: number; y2: number; label: string }
>

const STROKE = 2.5
const TICK = 9

/**
 * A measurement line: two draggable endpoints, perpendicular end ticks, and a
 * centered editable label that auto-orients to stay upright. The single most
 * "blueprint" primitive.
 */
export class DimensionLineShapeUtil extends ShapeUtil<DimensionLineShape> {
  static override type = 'dimension-line' as const
  static override props: RecordProps<DimensionLineShape> = {
    x2: T.number,
    y2: T.number,
    label: T.string,
  }

  getDefaultProps(): DimensionLineShape['props'] {
    return { x2: 220, y2: 0, label: '16 FEET' }
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

  getGeometry(shape: DimensionLineShape) {
    return new Edge2d({
      start: new Vec(0, 0),
      end: new Vec(shape.props.x2, shape.props.y2),
    })
  }

  override getHandles(shape: DimensionLineShape): TLHandle[] {
    return [
      {
        id: 'start',
        type: 'vertex',
        index: 'a1' as IndexKey,
        x: 0,
        y: 0,
      },
      {
        id: 'end',
        type: 'vertex',
        index: 'a2' as IndexKey,
        x: shape.props.x2,
        y: shape.props.y2,
      },
    ]
  }

  override onHandleDrag(
    shape: DimensionLineShape,
    { handle }: TLHandleDragInfo<DimensionLineShape>,
  ) {
    if (handle.id === 'end') {
      return {
        ...shape,
        props: { ...shape.props, x2: handle.x, y2: handle.y },
      }
    }
    // Dragging the start moves the shape origin and keeps the end anchored.
    const dx = handle.x
    const dy = handle.y
    return {
      ...shape,
      x: shape.x + dx,
      y: shape.y + dy,
      props: { ...shape.props, x2: shape.props.x2 - dx, y2: shape.props.y2 - dy },
    }
  }

  component(shape: DimensionLineShape) {
    const { x2, y2, label } = shape.props
    const seed = hashString(shape.id)
    const len = Math.hypot(x2, y2) || 1
    // Perpendicular unit vector for the end ticks.
    const nx = -y2 / len
    const ny = x2 / len
    const midX = x2 / 2
    const midY = y2 / 2

    // Keep the label upright: flip the line angle into [-90, 90].
    let angle = (Math.atan2(y2, x2) * 180) / Math.PI
    if (angle > 90) angle -= 180
    if (angle < -90) angle += 180

    const tick = (cx: number, cy: number) =>
      `M ${(cx + nx * TICK).toFixed(2)} ${(cy + ny * TICK).toFixed(2)} L ${(
        cx -
        nx * TICK
      ).toFixed(2)} ${(cy - ny * TICK).toFixed(2)}`

    return (
      <>
        <SVGContainer>
          <path
            d={chalkLinePath({ x: 0, y: 0 }, { x: x2, y: y2 }, seed)}
            style={{ fill: 'none', stroke: INK_COLOR }}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          <path
            d={tick(0, 0)}
            style={{ fill: 'none', stroke: INK_COLOR }}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          <path
            d={tick(x2, y2)}
            style={{ fill: 'none', stroke: INK_COLOR }}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
        </SVGContainer>
        <HTMLContainer>
          <div
            style={{
              position: 'absolute',
              left: midX,
              top: midY,
              transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-14px)`,
              transformOrigin: 'center',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              padding: '0 6px',
              minWidth: 40,
            }}
          >
            <EditableText
              shapeId={shape.id}
              value={label}
              placeholder="16 FEET"
              fontSize={22}
              onChange={(next) =>
                this.editor.updateShape<DimensionLineShape>({
                  id: shape.id,
                  type: 'dimension-line',
                  props: { label: next },
                })
              }
            />
          </div>
        </HTMLContainer>
      </>
    )
  }

  getIndicatorPath(shape: DimensionLineShape) {
    const p = new Path2D()
    p.moveTo(0, 0)
    p.lineTo(shape.props.x2, shape.props.y2)
    return p
  }
}
