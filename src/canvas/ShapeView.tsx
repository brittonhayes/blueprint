import { memo } from 'react'
import type { BlueprintEditor } from './editor'
import type { Shape } from './types'
import { getShapeDef } from '../shapes'

/**
 * Renders one shape into the camera-transformed layer: its silver ink (SVG in
 * local coordinates) plus any interactive HTML (text fields). The wrapper is
 * pointer-transparent so the canvas can do its own hit-testing; only editing
 * text fields opt back into pointer events. Memoised on shape identity so a
 * camera pan/zoom doesn't re-render every shape.
 */
export const ShapeView = memo(function ShapeView({
  shape,
  editor,
  editing,
}: {
  shape: Shape
  editor: BlueprintEditor
  editing: boolean
}) {
  const def = getShapeDef(shape.type)
  return (
    <div
      className="bp-shape"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transform: `translate(${shape.x}px, ${shape.y}px)`,
      }}
    >
      {def.Ink && (
        <svg
          className="bp-shape__ink"
          style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}
          width={1}
          height={1}
        >
          <def.Ink shape={shape} />
        </svg>
      )}
      {def.Html && <def.Html shape={shape} editor={editor} editing={editing} />}
    </div>
  )
})
