import type { TLAnyShapeUtilConstructor } from 'tldraw'
import { DimensionLineShapeUtil } from './DimensionLineShape'
import { LeaderCalloutShapeUtil } from './LeaderCalloutShape'
import { PartListShapeUtil } from './PartListShape'

/** All custom diagram shapes registered with the editor. */
export const customShapeUtils: TLAnyShapeUtilConstructor[] = [
  DimensionLineShapeUtil,
  LeaderCalloutShapeUtil,
  PartListShapeUtil,
]

export { DimensionLineShapeUtil, LeaderCalloutShapeUtil, PartListShapeUtil }
