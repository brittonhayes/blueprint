import type { ReactNode } from 'react'
import type { BlueprintEditor } from '../canvas/editor'
import type { Bounds, Handle, Shape, Vec } from '../canvas/types'

/**
 * The behaviour of one shape type, factored out of any drawing SDK.
 *
 * Every field is a pure function of a shape (except the render hooks, which are
 * React components). The canvas uses these for hit-testing, selection bounds,
 * handles, on-screen rendering, and PNG export. Coordinates are *local* to the
 * shape origin unless noted.
 */
export interface ShapeDef<S extends Shape = Shape> {
  type: S['type']

  /** Local bounding box, used for selection outlines and coarse hit-testing. */
  getBounds(shape: S): Bounds

  /** Precise hit test against a local-space point. */
  hitTest(shape: S, local: Vec): boolean

  /** Whether double-click enters text editing. */
  canEdit: boolean

  /** Draggable control points (local space). */
  getHandles?(shape: S): Handle[]

  /** New partial shape after a handle is dragged to `local`. */
  onHandleDrag?(shape: S, handleId: string, local: Vec): Partial<S>

  /** The silver ink, rendered as SVG in local coordinates. */
  Ink?(props: { shape: S }): ReactNode

  /** Interactive HTML (text fields), rendered in local coordinates. */
  Html?(props: {
    shape: S
    editor: BlueprintEditor
    editing: boolean
  }): ReactNode

  /** Inner SVG markup for PNG export (local coordinates). */
  toExportSvg(shape: S): string
}

/** Escape text for inclusion in exported SVG markup. */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
