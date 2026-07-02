import {
  chalkArcPath,
  chalkCirclePath,
  chalkEllipsePath,
  chalkLinePath,
  chalkPolyPath,
} from '../canvas/chalk'

/**
 * The Parts Bin catalog.
 *
 * Every part is authored as a list of geometric primitives; at render time the
 * primitives are converted to *seeded* chalk paths, so a placed part gets the
 * same hand-drawn waver as a freehand stroke — stable per shape, unique per
 * placement. One pure function ({@link stencilInkOps}) feeds both the live SVG
 * renderer and the PNG exporter.
 */

export type StencilPrim =
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { k: 'poly'; pts: [number, number][]; closed?: boolean }
  | { k: 'circle'; cx: number; cy: number; r: number }
  | { k: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { k: 'arc'; cx: number; cy: number; rx: number; ry: number; a0: number; a1: number }
  | { k: 'dot'; cx: number; cy: number; r: number }
  | { k: 'pie'; cx: number; cy: number; r: number; a0: number; a1: number }
  | { k: 'label'; x: number; y: number; text: string; size: number; bold?: boolean }

export interface StencilDef {
  kind: string
  label: string
  /** Nominal size at scale 1, in world px. */
  w: number
  h: number
  /** Stroke width override (stamps are bolder). */
  stroke?: number
  /** Whole-part rotation in degrees (stamps slap on slightly crooked). */
  tilt?: number
  prims: StencilPrim[]
}

/** One drawable op: either a path (stroked or filled) or hand-lettered text. */
export type InkOp =
  | { t: 'stroke'; d: string; width: number }
  | { t: 'fill'; d: string }
  | { t: 'text'; x: number; y: number; text: string; size: number; bold: boolean }

const TAU = Math.PI * 2

/** Convert a part's primitives into concrete ink ops for the given seed. */
export function stencilInkOps(def: StencilDef, seed: number): InkOp[] {
  const width = def.stroke ?? 2.5
  const ops: InkOp[] = []
  def.prims.forEach((p, i) => {
    const s = seed + i * 101
    switch (p.k) {
      case 'line':
        ops.push({
          t: 'stroke',
          d: chalkLinePath({ x: p.x1, y: p.y1 }, { x: p.x2, y: p.y2 }, s),
          width,
        })
        break
      case 'poly':
        ops.push({
          t: 'stroke',
          d: chalkPolyPath(
            p.pts.map(([x, y]) => ({ x, y })),
            s,
            p.closed,
          ),
          width,
        })
        break
      case 'circle':
        ops.push({ t: 'stroke', d: chalkCirclePath(p.cx, p.cy, p.r, s), width })
        break
      case 'ellipse':
        ops.push({ t: 'stroke', d: chalkEllipsePath(p.cx, p.cy, p.rx, p.ry, s), width })
        break
      case 'arc':
        ops.push({
          t: 'stroke',
          d: chalkArcPath(p.cx, p.cy, p.rx, p.ry, p.a0, p.a1, s),
          width,
        })
        break
      case 'dot':
        ops.push({ t: 'fill', d: dotPath(p.cx, p.cy, p.r) })
        break
      case 'pie':
        ops.push({ t: 'fill', d: piePath(p.cx, p.cy, p.r, p.a0, p.a1) })
        break
      case 'label':
        ops.push({ t: 'text', x: p.x, y: p.y, text: p.text, size: p.size, bold: !!p.bold })
        break
    }
  })
  return ops
}

function dotPath(cx: number, cy: number, r: number): string {
  return (
    `M ${(cx - r).toFixed(2)} ${cy.toFixed(2)} ` +
    `a ${r} ${r} 0 1 0 ${(r * 2).toFixed(2)} 0 a ${r} ${r} 0 1 0 ${(-r * 2).toFixed(2)} 0 Z`
  )
}

function piePath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const x0 = cx + Math.cos(a0) * r
  const y0 = cy + Math.sin(a0) * r
  const x1 = cx + Math.cos(a1) * r
  const y1 = cy + Math.sin(a1) * r
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0
  return (
    `M ${cx.toFixed(2)} ${cy.toFixed(2)} L ${x0.toFixed(2)} ${y0.toFixed(2)} ` +
    `A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`
  )
}

/** Regular gear outline: alternating tooth tip / root points around a circle. */
function gearPts(
  cx: number,
  cy: number,
  outer: number,
  root: number,
  teeth: number,
): [number, number][] {
  const pts: [number, number][] = []
  const step = TAU / teeth
  for (let i = 0; i < teeth; i++) {
    const a = i * step
    // Four corners per tooth: root-rise, tip-start, tip-end, root-fall.
    pts.push(pt(cx, cy, root, a + step * 0.1))
    pts.push(pt(cx, cy, outer, a + step * 0.25))
    pts.push(pt(cx, cy, outer, a + step * 0.55))
    pts.push(pt(cx, cy, root, a + step * 0.7))
  }
  return pts
}

function pt(cx: number, cy: number, r: number, a: number): [number, number] {
  return [
    Math.round((cx + Math.cos(a) * r) * 10) / 10,
    Math.round((cy + Math.sin(a) * r) * 10) / 10,
  ]
}

// ── The parts ─────────────────────────────────────────────────────────────

// The Lego bricks: plain geometry you rough a whole design out of before any
// themed part comes off the shelf. They lead the bin for that reason.
const BASICS: StencilDef[] = [
  {
    kind: 'box',
    label: 'Box',
    w: 120,
    h: 90,
    prims: [{ k: 'poly', pts: [[0, 0], [120, 0], [120, 90], [0, 90]], closed: true }],
  },
  {
    kind: 'round',
    label: 'Circle',
    w: 100,
    h: 100,
    prims: [{ k: 'circle', cx: 50, cy: 50, r: 48 }],
  },
  {
    kind: 'triangle',
    label: 'Triangle',
    w: 110,
    h: 95,
    prims: [{ k: 'poly', pts: [[55, 0], [110, 95], [0, 95]], closed: true }],
  },
  {
    kind: 'diamond',
    label: 'Diamond',
    w: 100,
    h: 100,
    prims: [{ k: 'poly', pts: [[50, 0], [100, 50], [50, 100], [0, 50]], closed: true }],
  },
  {
    kind: 'strut',
    label: 'Line',
    w: 140,
    h: 16,
    prims: [{ k: 'line', x1: 0, y1: 8, x2: 140, y2: 8 }],
  },
  {
    kind: 'arrow',
    label: 'Arrow',
    w: 140,
    h: 44,
    prims: [
      { k: 'line', x1: 0, y1: 22, x2: 136, y2: 22 },
      { k: 'line', x1: 136, y1: 22, x2: 110, y2: 6 },
      { k: 'line', x1: 136, y1: 22, x2: 110, y2: 38 },
    ],
  },
]

const RIGS: StencilDef[] = [
  {
    kind: 'gear',
    label: 'Gear',
    w: 110,
    h: 110,
    prims: [
      { k: 'poly', pts: gearPts(55, 55, 54, 44, 10), closed: true },
      { k: 'circle', cx: 55, cy: 55, r: 15 },
    ],
  },
  {
    kind: 'spring',
    label: 'Spring',
    w: 60,
    h: 120,
    prims: [
      {
        k: 'poly',
        pts: [
          [30, 0], [30, 12], [10, 22], [50, 34], [10, 46], [50, 58],
          [10, 70], [50, 82], [10, 94], [30, 106], [30, 120],
        ],
      },
    ],
  },
  {
    kind: 'pulley',
    label: 'Pulley',
    w: 90,
    h: 130,
    prims: [
      { k: 'poly', pts: [[30, 0], [60, 0], [45, 26]], closed: true },
      { k: 'circle', cx: 45, cy: 62, r: 34 },
      { k: 'dot', cx: 45, cy: 62, r: 4.5 },
      { k: 'line', x1: 11, y1: 62, x2: 11, y2: 130 },
      { k: 'line', x1: 79, y1: 62, x2: 79, y2: 130 },
    ],
  },
  {
    kind: 'wheel',
    label: 'Wheel',
    w: 110,
    h: 110,
    prims: [
      { k: 'circle', cx: 55, cy: 55, r: 52 },
      { k: 'circle', cx: 55, cy: 55, r: 14 },
      { k: 'line', x1: 55, y1: 41, x2: 55, y2: 4 },
      { k: 'line', x1: 55, y1: 69, x2: 55, y2: 106 },
      { k: 'line', x1: 41, y1: 55, x2: 4, y2: 55 },
      { k: 'line', x1: 69, y1: 55, x2: 106, y2: 55 },
    ],
  },
  {
    kind: 'rocket',
    label: 'Rocket',
    w: 70,
    h: 120,
    prims: [
      { k: 'poly', pts: [[35, 0], [51, 24], [53, 84], [17, 84], [19, 24]], closed: true },
      { k: 'poly', pts: [[17, 84], [3, 114], [21, 98]] },
      { k: 'poly', pts: [[53, 84], [67, 114], [49, 98]] },
      { k: 'circle', cx: 35, cy: 42, r: 9 },
      { k: 'line', x1: 27, y1: 96, x2: 27, y2: 112 },
      { k: 'line', x1: 43, y1: 96, x2: 43, y2: 112 },
    ],
  },
  {
    kind: 'lever',
    label: 'Lever',
    w: 130,
    h: 85,
    prims: [
      { k: 'poly', pts: [[52, 84], [78, 84], [65, 60]], closed: true },
      { k: 'line', x1: 4, y1: 74, x2: 126, y2: 48 },
      { k: 'circle', cx: 116, cy: 38, r: 9 },
    ],
  },
]

const CIRCUITS: StencilDef[] = [
  {
    kind: 'battery',
    label: 'Battery',
    w: 120,
    h: 60,
    prims: [
      { k: 'poly', pts: [[0, 10], [104, 10], [104, 50], [0, 50]], closed: true },
      { k: 'poly', pts: [[104, 22], [117, 22], [117, 38], [104, 38]], closed: true },
      { k: 'label', x: 20, y: 40, text: '+', size: 30 },
      { k: 'label', x: 86, y: 38, text: '-', size: 34 },
    ],
  },
  {
    kind: 'switch',
    label: 'Switch',
    w: 110,
    h: 70,
    prims: [
      { k: 'line', x1: 0, y1: 56, x2: 110, y2: 56 },
      { k: 'dot', cx: 30, cy: 52, r: 5 },
      { k: 'dot', cx: 84, cy: 52, r: 5 },
      { k: 'line', x1: 30, y1: 52, x2: 82, y2: 12 },
    ],
  },
  {
    kind: 'motor',
    label: 'Motor',
    w: 112,
    h: 95,
    prims: [
      { k: 'circle', cx: 45, cy: 45, r: 38 },
      { k: 'label', x: 45, y: 60, text: 'M', size: 38 },
      { k: 'line', x1: 83, y1: 45, x2: 112, y2: 45 },
      { k: 'line', x1: 26, y1: 78, x2: 26, y2: 94 },
      { k: 'line', x1: 64, y1: 78, x2: 64, y2: 94 },
    ],
  },
  {
    kind: 'bulb',
    label: 'Bulb',
    w: 80,
    h: 108,
    prims: [
      { k: 'circle', cx: 40, cy: 35, r: 30 },
      { k: 'poly', pts: [[28, 52], [34, 40], [40, 52], [46, 40], [52, 52]] },
      { k: 'poly', pts: [[28, 63], [52, 63], [49, 86], [31, 86]], closed: true },
      { k: 'line', x1: 30, y1: 71, x2: 50, y2: 71 },
      { k: 'line', x1: 31, y1: 79, x2: 49, y2: 79 },
    ],
  },
  {
    kind: 'resistor',
    label: 'Resistor',
    w: 130,
    h: 40,
    prims: [
      { k: 'line', x1: 0, y1: 20, x2: 20, y2: 20 },
      {
        k: 'poly',
        pts: [
          [20, 20], [28, 4], [40, 36], [52, 4], [64, 36], [76, 4], [88, 36], [96, 20],
        ],
      },
      { k: 'line', x1: 96, y1: 20, x2: 130, y2: 20 },
    ],
  },
]

const SOFTWARE: StencilDef[] = [
  {
    kind: 'server',
    label: 'Server rack',
    w: 80,
    h: 120,
    prims: [
      { k: 'poly', pts: [[0, 0], [80, 0], [80, 120], [0, 120]], closed: true },
      { k: 'line', x1: 0, y1: 40, x2: 80, y2: 40 },
      { k: 'line', x1: 0, y1: 80, x2: 80, y2: 80 },
      { k: 'dot', cx: 14, cy: 20, r: 4 },
      { k: 'dot', cx: 14, cy: 60, r: 4 },
      { k: 'dot', cx: 14, cy: 100, r: 4 },
      { k: 'line', x1: 34, y1: 20, x2: 66, y2: 20 },
      { k: 'line', x1: 34, y1: 60, x2: 66, y2: 60 },
      { k: 'line', x1: 34, y1: 100, x2: 66, y2: 100 },
    ],
  },
  {
    kind: 'database',
    label: 'Database',
    w: 90,
    h: 110,
    prims: [
      { k: 'ellipse', cx: 45, cy: 17, rx: 42, ry: 15 },
      { k: 'line', x1: 3, y1: 17, x2: 3, y2: 93 },
      { k: 'line', x1: 87, y1: 17, x2: 87, y2: 93 },
      { k: 'arc', cx: 45, cy: 93, rx: 42, ry: 15, a0: 0, a1: Math.PI },
      { k: 'arc', cx: 45, cy: 45, rx: 42, ry: 15, a0: 0, a1: Math.PI },
    ],
  },
  {
    kind: 'browser',
    label: 'Browser',
    w: 130,
    h: 95,
    prims: [
      { k: 'poly', pts: [[0, 0], [130, 0], [130, 95], [0, 95]], closed: true },
      { k: 'line', x1: 0, y1: 22, x2: 130, y2: 22 },
      { k: 'dot', cx: 13, cy: 11, r: 3.5 },
      { k: 'dot', cx: 27, cy: 11, r: 3.5 },
      { k: 'dot', cx: 41, cy: 11, r: 3.5 },
      { k: 'line', x1: 14, y1: 42, x2: 116, y2: 42 },
      { k: 'line', x1: 14, y1: 58, x2: 88, y2: 58 },
      { k: 'line', x1: 14, y1: 74, x2: 104, y2: 74 },
    ],
  },
  {
    kind: 'cloud',
    label: 'Cloud',
    w: 130,
    h: 85,
    prims: [
      { k: 'arc', cx: 38, cy: 55, rx: 24, ry: 22, a0: Math.PI * 0.25, a1: Math.PI * 1.32 },
      { k: 'arc', cx: 67, cy: 38, rx: 30, ry: 26, a0: Math.PI * 1.05, a1: Math.PI * 2.02 },
      { k: 'arc', cx: 100, cy: 58, rx: 22, ry: 20, a0: Math.PI * 1.42, a1: Math.PI * 2.42 },
      { k: 'line', x1: 24, y1: 76, x2: 106, y2: 76 },
    ],
  },
  {
    kind: 'chip',
    label: 'Chip',
    w: 100,
    h: 100,
    prims: [
      { k: 'poly', pts: [[20, 20], [80, 20], [80, 80], [20, 80]], closed: true },
      { k: 'poly', pts: [[38, 38], [62, 38], [62, 62], [38, 62]], closed: true },
      { k: 'line', x1: 32, y1: 20, x2: 32, y2: 4 },
      { k: 'line', x1: 50, y1: 20, x2: 50, y2: 4 },
      { k: 'line', x1: 68, y1: 20, x2: 68, y2: 4 },
      { k: 'line', x1: 32, y1: 80, x2: 32, y2: 96 },
      { k: 'line', x1: 50, y1: 80, x2: 50, y2: 96 },
      { k: 'line', x1: 68, y1: 80, x2: 68, y2: 96 },
      { k: 'line', x1: 20, y1: 32, x2: 4, y2: 32 },
      { k: 'line', x1: 20, y1: 50, x2: 4, y2: 50 },
      { k: 'line', x1: 20, y1: 68, x2: 4, y2: 68 },
      { k: 'line', x1: 80, y1: 32, x2: 96, y2: 32 },
      { k: 'line', x1: 80, y1: 50, x2: 96, y2: 50 },
      { k: 'line', x1: 80, y1: 68, x2: 96, y2: 68 },
    ],
  },
]

const STRUCTURES: StencilDef[] = [
  {
    kind: 'ibeam',
    label: 'I-beam',
    w: 90,
    h: 110,
    prims: [
      {
        k: 'poly',
        pts: [
          [5, 0], [85, 0], [85, 14], [56, 14], [56, 96], [85, 96],
          [85, 110], [5, 110], [5, 96], [34, 96], [34, 14], [5, 14],
        ],
        closed: true,
      },
    ],
  },
  {
    kind: 'truss',
    label: 'Truss',
    w: 140,
    h: 70,
    prims: [
      { k: 'line', x1: 10, y1: 5, x2: 130, y2: 5 },
      { k: 'line', x1: 0, y1: 65, x2: 140, y2: 65 },
      { k: 'line', x1: 10, y1: 5, x2: 0, y2: 65 },
      { k: 'line', x1: 130, y1: 5, x2: 140, y2: 65 },
      { k: 'poly', pts: [[10, 5], [35, 65], [60, 5], [85, 65], [110, 5], [130, 65]] },
    ],
  },
  {
    kind: 'ladder',
    label: 'Ladder',
    w: 60,
    h: 130,
    prims: [
      { k: 'line', x1: 10, y1: 0, x2: 10, y2: 130 },
      { k: 'line', x1: 50, y1: 0, x2: 50, y2: 130 },
      { k: 'line', x1: 10, y1: 15, x2: 50, y2: 15 },
      { k: 'line', x1: 10, y1: 38, x2: 50, y2: 38 },
      { k: 'line', x1: 10, y1: 61, x2: 50, y2: 61 },
      { k: 'line', x1: 10, y1: 84, x2: 50, y2: 84 },
      { k: 'line', x1: 10, y1: 107, x2: 50, y2: 107 },
    ],
  },
  {
    kind: 'door',
    label: 'Door (plan)',
    w: 110,
    h: 110,
    prims: [
      { k: 'line', x1: 0, y1: 105, x2: 110, y2: 105 },
      { k: 'line', x1: 15, y1: 105, x2: 15, y2: 15 },
      { k: 'arc', cx: 15, cy: 105, rx: 90, ry: 90, a0: -Math.PI / 2, a1: 0 },
    ],
  },
  {
    kind: 'wall',
    label: 'Brick wall',
    w: 130,
    h: 90,
    prims: [
      { k: 'poly', pts: [[0, 0], [130, 0], [130, 90], [0, 90]], closed: true },
      { k: 'line', x1: 0, y1: 30, x2: 130, y2: 30 },
      { k: 'line', x1: 0, y1: 60, x2: 130, y2: 60 },
      { k: 'line', x1: 43, y1: 0, x2: 43, y2: 30 },
      { k: 'line', x1: 86, y1: 0, x2: 86, y2: 30 },
      { k: 'line', x1: 21, y1: 30, x2: 21, y2: 60 },
      { k: 'line', x1: 65, y1: 30, x2: 65, y2: 60 },
      { k: 'line', x1: 108, y1: 30, x2: 108, y2: 60 },
      { k: 'line', x1: 43, y1: 60, x2: 43, y2: 90 },
      { k: 'line', x1: 86, y1: 60, x2: 86, y2: 90 },
    ],
  },
]

const LAB: StencilDef[] = [
  {
    kind: 'flask',
    label: 'Flask',
    w: 90,
    h: 110,
    prims: [
      { k: 'line', x1: 28, y1: 0, x2: 62, y2: 0 },
      { k: 'line', x1: 33, y1: 0, x2: 33, y2: 30 },
      { k: 'line', x1: 57, y1: 0, x2: 57, y2: 30 },
      { k: 'line', x1: 33, y1: 30, x2: 8, y2: 100 },
      { k: 'line', x1: 57, y1: 30, x2: 82, y2: 100 },
      { k: 'line', x1: 8, y1: 100, x2: 82, y2: 100 },
      { k: 'line', x1: 22, y1: 62, x2: 68, y2: 62 },
      { k: 'dot', cx: 38, cy: 78, r: 3 },
      { k: 'dot', cx: 54, cy: 84, r: 2.5 },
      { k: 'dot', cx: 46, cy: 70, r: 2 },
    ],
  },
  {
    kind: 'gauge',
    label: 'Gauge',
    w: 110,
    h: 70,
    prims: [
      { k: 'arc', cx: 55, cy: 60, rx: 48, ry: 48, a0: Math.PI, a1: TAU },
      { k: 'line', x1: 7, y1: 60, x2: 103, y2: 60 },
      { k: 'line', x1: 15, y1: 42, x2: 23, y2: 46 },
      { k: 'line', x1: 32, y1: 22, x2: 38, y2: 29 },
      { k: 'line', x1: 55, y1: 12, x2: 55, y2: 21 },
      { k: 'line', x1: 78, y1: 22, x2: 72, y2: 29 },
      { k: 'line', x1: 95, y1: 42, x2: 87, y2: 46 },
      { k: 'line', x1: 55, y1: 60, x2: 32, y2: 27 },
      { k: 'dot', cx: 55, cy: 60, r: 5 },
    ],
  },
  {
    kind: 'target',
    label: 'Target',
    w: 110,
    h: 110,
    prims: [
      { k: 'circle', cx: 55, cy: 55, r: 50 },
      { k: 'circle', cx: 55, cy: 55, r: 32 },
      { k: 'circle', cx: 55, cy: 55, r: 15 },
      { k: 'dot', cx: 55, cy: 55, r: 4 },
      { k: 'line', x1: 55, y1: 0, x2: 55, y2: 14 },
      { k: 'line', x1: 55, y1: 96, x2: 55, y2: 110 },
      { k: 'line', x1: 0, y1: 55, x2: 14, y2: 55 },
      { k: 'line', x1: 96, y1: 55, x2: 110, y2: 55 },
    ],
  },
  {
    kind: 'danger',
    label: 'Danger',
    w: 110,
    h: 100,
    prims: [
      { k: 'poly', pts: [[55, 4], [106, 94], [4, 94]], closed: true },
      { k: 'line', x1: 55, y1: 34, x2: 55, y2: 64 },
      { k: 'dot', cx: 55, cy: 78, r: 4 },
    ],
  },
  {
    kind: 'crash-marker',
    label: 'Crash marker',
    w: 100,
    h: 100,
    prims: [
      { k: 'circle', cx: 50, cy: 50, r: 46 },
      { k: 'line', x1: 4, y1: 50, x2: 96, y2: 50 },
      { k: 'line', x1: 50, y1: 4, x2: 50, y2: 96 },
      { k: 'pie', cx: 50, cy: 50, r: 44, a0: -Math.PI / 2, a1: 0 },
      { k: 'pie', cx: 50, cy: 50, r: 44, a0: Math.PI / 2, a1: Math.PI },
    ],
  },
]

const stamp = (kind: string, label: string, text: string, w: number): StencilDef => ({
  kind,
  label,
  w,
  h: 80,
  stroke: 3.2,
  tilt: -3.5,
  prims: [
    { k: 'poly', pts: [[0, 0], [w, 0], [w, 80], [0, 80]], closed: true },
    { k: 'poly', pts: [[7, 7], [w - 7, 7], [w - 7, 73], [7, 73]], closed: true },
    { k: 'label', x: w / 2, y: 57, text, size: 46, bold: true },
  ],
})

const VERDICTS: StencilDef[] = [
  stamp('stamp-busted', 'Busted', 'BUSTED', 220),
  stamp('stamp-plausible', 'Plausible', 'PLAUSIBLE', 265),
  stamp('stamp-confirmed', 'Confirmed', 'CONFIRMED', 280),
]

export interface StencilCategory {
  id: string
  label: string
  parts: StencilDef[]
}

// Ordered by how early you reach for each while building a plate: rough the
// design out (Basics), annotate it (Notation lives in the bin UI between
// these), then the themed shelves, with the Verdict stamps as the punchline.
export const STENCIL_CATEGORIES: StencilCategory[] = [
  { id: 'basics', label: 'Basics', parts: BASICS },
  { id: 'rigs', label: 'Rigs', parts: RIGS },
  { id: 'circuits', label: 'Circuits', parts: CIRCUITS },
  { id: 'software', label: 'Software', parts: SOFTWARE },
  { id: 'structures', label: 'Structures', parts: STRUCTURES },
  { id: 'lab', label: 'Test Lab', parts: LAB },
  { id: 'verdicts', label: 'Verdicts', parts: VERDICTS },
]

const byKind = new Map<string, StencilDef>()
for (const cat of STENCIL_CATEGORIES) {
  for (const part of cat.parts) byKind.set(part.kind, part)
}

export function getStencilDef(kind: string): StencilDef | undefined {
  return byKind.get(kind)
}
