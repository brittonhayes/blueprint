import { createShapeId } from '../canvas/editor'
import type { CustomShapeType, Shape, ShapeType } from '../canvas/types'
import type { ShapeDef } from './shared'
import { drawDef } from './DrawShape'
import { textDef } from './TextShape'
import { dimensionLineDef } from './DimensionLineShape'
import { leaderCalloutDef } from './LeaderCalloutShape'
import { partListDef } from './PartListShape'

/** Every shape type the editor understands, keyed by `type`. */
export const shapeDefs: Record<ShapeType, ShapeDef> = {
  draw: drawDef as ShapeDef,
  text: textDef as ShapeDef,
  'dimension-line': dimensionLineDef as ShapeDef,
  'leader-callout': leaderCalloutDef as ShapeDef,
  'part-list': partListDef as ShapeDef,
}

export function getShapeDef(type: ShapeType): ShapeDef {
  return shapeDefs[type]
}

/** Build a fresh custom diagram shape of the given type at (x, y). */
export function makeCustomShape(
  type: CustomShapeType,
  x: number,
  y: number,
): Shape {
  const id = createShapeId(type)
  switch (type) {
    case 'dimension-line':
      return { id, type, x, y, x2: 220, y2: 0, label: '16 FEET' }
    case 'leader-callout':
      return { id, type, x, y, w: 150, h: 32, tx: 120, ty: 96, label: 'MAIN CROSSBEAM' }
    case 'part-list':
      return {
        id,
        type,
        x,
        y,
        w: 260,
        title: 'SOLDIERS',
        items: ['Boots', 'Actuators', 'Solenoids', 'Switch on timer'],
      }
  }
}

export type { ShapeDef } from './shared'
