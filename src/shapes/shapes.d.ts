// Register the custom diagram shapes with tldraw's type system so the editor's
// generic APIs (createShape, updateShape, ShapeUtil<Shape>) accept them. This
// is the documented augmentation point: TLShape is derived from this map.
import '@tldraw/tlschema'

declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    'dimension-line': { x2: number; y2: number; label: string }
    'leader-callout': {
      w: number
      h: number
      tx: number
      ty: number
      label: string
    }
    'part-list': { w: number; title: string; items: string[] }
  }
}
