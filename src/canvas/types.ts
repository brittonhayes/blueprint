/**
 * The document model for the blueprint canvas.
 *
 * Everything the editor knows about a plate is a flat list of these shapes plus
 * a camera. There is no external SDK — shapes are plain serializable objects and
 * every renderer/geometry helper is a pure function of one of them.
 */

export interface Vec {
  x: number
  y: number
}

/** A freehand stroke input point with pen pressure (0..1). */
export interface StrokePoint {
  x: number
  y: number
  p: number
}

interface ShapeBase {
  id: string
  x: number
  y: number
  /** Rotation in radians about the centre of the local bounds. Absent = 0. */
  rotation?: number
  /** Uniform scale about the centre of the local bounds. Absent = 1. */
  scale?: number
}

/** Silver-sharpie freehand stroke. Points are relative to the shape origin. */
export interface DrawShape extends ShapeBase {
  type: 'draw'
  points: StrokePoint[]
  size: number
}

/** A free-floating hand-lettered text label. */
export interface TextShape extends ShapeBase {
  type: 'text'
  text: string
  fontSize: number
}

/** A measurement line: origin → (x2,y2), end ticks, centered label. */
export interface DimensionLineShape extends ShapeBase {
  type: 'dimension-line'
  x2: number
  y2: number
  label: string
}

/** A label with an underline shelf and a leader arrow to a target point. */
export interface LeaderCalloutShape extends ShapeBase {
  type: 'leader-callout'
  w: number
  h: number
  tx: number
  ty: number
  label: string
}

/** A titled, auto-numbered parts block. */
export interface PartListShape extends ShapeBase {
  type: 'part-list'
  w: number
  title: string
  items: string[]
}

/** A hand-drawn part placed from the Parts Bin. Scaling uses the base `scale`. */
export interface StencilShape extends ShapeBase {
  type: 'stencil'
  /** Catalog kind, e.g. 'gear' or 'stamp-busted'. */
  kind: string
}

export type Shape =
  | DrawShape
  | TextShape
  | DimensionLineShape
  | LeaderCalloutShape
  | PartListShape
  | StencilShape

export type ShapeType = Shape['type']

/** The custom diagram primitives offered in the dock's diagram popover. */
export type CustomShapeType = 'dimension-line' | 'leader-callout' | 'part-list'

export type ToolId = 'draw' | 'eraser' | 'text' | 'select'

/** Screen = (world + {x,y}) * z. */
export interface Camera {
  x: number
  y: number
  z: number
}

/** A draggable control point on a shape, in the shape's local coordinates. */
export interface Handle {
  id: string
  x: number
  y: number
}

export interface Bounds {
  x: number
  y: number
  w: number
  h: number
}

export interface EditorSnapshot {
  shapes: Shape[]
  camera: Camera
  tool: ToolId
  selectedIds: string[]
  editingId: string | null
}
