import { type Editor, createShapeId } from 'tldraw'

/** Configure the editor the moment it mounts: no grid, pen ready, snapping on. */
export function configureEditor(editor: Editor) {
  editor.updateInstanceState({ isGridMode: false })
  editor.user.updateUserPreferences({ isSnapMode: true })
  // Land on the pen so the first gesture draws.
  editor.setCurrentTool('draw')
}

export type CustomShapeType = 'dimension-line' | 'leader-callout' | 'part-list'

/**
 * Drop a custom diagram shape into the middle of the current viewport, select
 * it, and switch to the select tool so it's immediately movable.
 */
export function insertCustomShape(editor: Editor, type: CustomShapeType) {
  const id = createShapeId()
  const center = editor.getViewportPageBounds().center
  // Offset so the shape's origin (not center) lands roughly centered.
  const offset = type === 'part-list' ? { x: 130, y: 90 } : { x: 110, y: 20 }
  editor.createShape({
    id,
    type,
    x: center.x - offset.x,
    y: center.y - offset.y,
  })
  editor.setCurrentTool('select')
  editor.select(id)
  return id
}

/** Remove every shape on the current page. */
export function clearPage(editor: Editor) {
  const ids = Array.from(editor.getCurrentPageShapeIds())
  if (ids.length) editor.deleteShapes(ids)
}
