import { createShapeId } from '../canvas/editor'
import type { BlueprintEditor } from '../canvas/editor'
import type { CustomShapeType, StencilShape } from '../canvas/types'
import { makeCustomShape } from '../shapes'
import { getStencilDef } from '../stencils/catalog'

export type { CustomShapeType }

/**
 * Drop a custom diagram shape into the middle of the current viewport, select
 * it, and switch to the select tool so it's immediately movable.
 */
export function insertCustomShape(editor: BlueprintEditor, type: CustomShapeType) {
  const center = editor.getViewportCenter()
  // Offset so the shape's origin (not center) lands roughly centered.
  const offset = type === 'part-list' ? { x: 130, y: 90 } : { x: 110, y: 20 }
  const shape = makeCustomShape(type, center.x - offset.x, center.y - offset.y)
  editor.createShape(shape)
  editor.setCurrentTool('select')
  editor.select(shape.id)
  return shape.id
}

/** Drop a Parts Bin stencil centered in the viewport, selected and movable. */
export function insertStencil(editor: BlueprintEditor, kind: string) {
  const def = getStencilDef(kind)
  if (!def) return null
  const center = editor.getViewportCenter()
  const shape: StencilShape = {
    id: createShapeId('stencil'),
    type: 'stencil',
    kind,
    scale: 1,
    x: center.x - def.w / 2,
    y: center.y - def.h / 2,
  }
  editor.createShape(shape)
  editor.setCurrentTool('select')
  editor.select(shape.id)
  return shape.id
}

/** Remove every shape on the current page. */
export function clearPage(editor: BlueprintEditor) {
  editor.clearPage()
}
