import {
  ShapeUtil,
  SVGContainer,
  HTMLContainer,
  Group2d,
  Rectangle2d,
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

export type LeaderCalloutShape = TLBaseShape<
  'leader-callout',
  { w: number; h: number; tx: number; ty: number; label: string }
>

const STROKE = 2.5

/**
 * A leader: a hand-lettered label with an underline "shelf" and a line out to
 * a draggable target point with an arrowhead — like the "MAIN CROSSBEAM" and
 * "TOWERS 6' TALL" annotations on the reference plates.
 */
export class LeaderCalloutShapeUtil extends ShapeUtil<LeaderCalloutShape> {
  static override type = 'leader-callout' as const
  static override props: RecordProps<LeaderCalloutShape> = {
    w: T.number,
    h: T.number,
    tx: T.number,
    ty: T.number,
    label: T.string,
  }

  getDefaultProps(): LeaderCalloutShape['props'] {
    return { w: 150, h: 32, tx: 120, ty: 96, label: 'MAIN CROSSBEAM' }
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

  getGeometry(shape: LeaderCalloutShape) {
    const { w, h, tx, ty } = shape.props
    return new Group2d({
      children: [
        new Rectangle2d({ x: 0, y: 0, width: w, height: h, isFilled: true }),
        new Edge2d({ start: new Vec(w, h), end: new Vec(tx, ty) }),
      ],
    })
  }

  override getHandles(shape: LeaderCalloutShape): TLHandle[] {
    return [
      {
        id: 'target',
        type: 'vertex',
        index: 'a1' as IndexKey,
        x: shape.props.tx,
        y: shape.props.ty,
      },
    ]
  }

  override onHandleDrag(
    shape: LeaderCalloutShape,
    { handle }: TLHandleDragInfo<LeaderCalloutShape>,
  ) {
    return { ...shape, props: { ...shape.props, tx: handle.x, ty: handle.y } }
  }

  component(shape: LeaderCalloutShape) {
    const { w, h, tx, ty, label } = shape.props
    const seed = hashString(shape.id)

    // Arrowhead at the target, pointing back along the leader.
    const ang = Math.atan2(ty - h, tx - w)
    const a = 0.45
    const headLen = 11
    const ah1 = {
      x: tx - headLen * Math.cos(ang - a),
      y: ty - headLen * Math.sin(ang - a),
    }
    const ah2 = {
      x: tx - headLen * Math.cos(ang + a),
      y: ty - headLen * Math.sin(ang + a),
    }

    return (
      <>
        <SVGContainer>
          {/* underline shelf under the label */}
          <path
            d={chalkLinePath({ x: 0, y: h }, { x: w, y: h }, seed + 5)}
            style={{ fill: 'none', stroke: INK_COLOR }}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {/* leader line to target */}
          <path
            d={chalkLinePath({ x: w, y: h }, { x: tx, y: ty }, seed + 9)}
            style={{ fill: 'none', stroke: INK_COLOR }}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {/* arrowhead */}
          <path
            d={`M ${ah1.x.toFixed(2)} ${ah1.y.toFixed(2)} L ${tx.toFixed(
              2,
            )} ${ty.toFixed(2)} L ${ah2.x.toFixed(2)} ${ah2.y.toFixed(2)}`}
            style={{ fill: 'none', stroke: INK_COLOR }}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </SVGContainer>
        <HTMLContainer>
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
              pointerEvents: 'none',
            }}
          >
            <EditableText
              shapeId={shape.id}
              value={label}
              placeholder="LABEL"
              align="left"
              fontSize={22}
              onChange={(next) =>
                this.editor.updateShape<LeaderCalloutShape>({
                  id: shape.id,
                  type: 'leader-callout',
                  props: { label: next },
                })
              }
            />
          </div>
        </HTMLContainer>
      </>
    )
  }

  getIndicatorPath(shape: LeaderCalloutShape) {
    const { w, h, tx, ty } = shape.props
    const p = new Path2D()
    p.rect(0, 0, w, h)
    p.moveTo(w, h)
    p.lineTo(tx, ty)
    return p
  }
}
