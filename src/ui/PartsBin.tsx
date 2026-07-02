import { useEffect, useState } from 'react'
import { useEditor } from '../canvas/react'
import { insertCustomShape, insertStencil } from '../lib/editorActions'
import { hashString } from '../canvas/chalk'
import { INK_COLOR } from '../canvas/blueprintTheme'
import {
  STENCIL_CATEGORIES,
  stencilInkOps,
  type StencilDef,
} from '../stencils/catalog'
import type { CustomShapeType } from '../canvas/types'
import { DimensionIcon, LeaderIcon, ListIcon } from './icons'
import './partsbin.css'

/**
 * The Parts Bin: a workshop drawer of ready-made, hand-drawn parts.
 *
 * Every thumbnail is rendered from the same primitive catalog the canvas
 * uses, so what you see in the drawer is exactly the ink you get on the
 * plate. Notation (dimension lines, callouts, part lists) lives here too.
 */

const NOTATION: Array<{ type: CustomShapeType; label: string; Icon: typeof DimensionIcon }> = [
  { type: 'dimension-line', label: 'Dimension', Icon: DimensionIcon },
  { type: 'leader-callout', label: 'Callout', Icon: LeaderIcon },
  { type: 'part-list', label: 'Part list', Icon: ListIcon },
]

// Tab order mirrors how a plate gets built: rough it out with Basics,
// annotate with Notation, then the themed shelves. Notation isn't a stencil
// category, so it's spliced into the second slot here.
const TABS: Array<{ id: string; label: string }> = [
  ...STENCIL_CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
]
TABS.splice(1, 0, { id: 'notation', label: 'Notation' })

export function PartsBin() {
  const editor = useEditor()
  const [open, setOpen] = useState(false)
  const [catId, setCatId] = useState(STENCIL_CATEGORIES[0].id)

  // 'b' toggles the bin; Escape closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if (e.key === 'b') setOpen((v) => !v)
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const place = (fn: () => void) => {
    fn()
    // On a phone the drawer covers most of the plate — get out of the way.
    if (window.innerWidth < 700) setOpen(false)
  }

  const category = STENCIL_CATEGORIES.find((c) => c.id === catId) ?? STENCIL_CATEGORIES[0]

  return (
    <>
      {!open && (
        <button
          type="button"
          className="bp-bin-handle glass"
          onClick={() => setOpen(true)}
          aria-label="Open parts bin (B)"
          title="Parts bin (B)"
        >
          Parts Bin
        </button>
      )}

      {open && (
        <aside className="bp-bin glass" aria-label="Parts bin">
          <header className="bp-bin__head">
            <h2 className="bp-bin__title">Parts Bin</h2>
            <button
              type="button"
              className="bp-bin__close"
              onClick={() => setOpen(false)}
              aria-label="Close parts bin"
            >
              ×
            </button>
          </header>

          <nav className="bp-bin__cats" aria-label="Part categories">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`bp-bin__cat${tab.id === catId ? ' is-active' : ''}`}
                aria-pressed={tab.id === catId}
                onClick={() => setCatId(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="bp-bin__grid" role="list">
            {catId === 'notation'
              ? NOTATION.map(({ type, label, Icon }) => (
                  <button
                    key={type}
                    type="button"
                    role="listitem"
                    className="bp-bin__part"
                    onClick={() => place(() => insertCustomShape(editor, type))}
                  >
                    <span className="bp-bin__thumb bp-bin__thumb--icon">
                      <Icon size={34} />
                    </span>
                    <span className="bp-bin__name">{label}</span>
                  </button>
                ))
              : category.parts.map((part) => (
                  <button
                    key={part.kind}
                    type="button"
                    role="listitem"
                    className="bp-bin__part"
                    onClick={() => place(() => insertStencil(editor, part.kind))}
                  >
                    <span className="bp-bin__thumb">
                      <StencilThumb def={part} />
                    </span>
                    <span className="bp-bin__name">{part.label}</span>
                  </button>
                ))}
          </div>
        </aside>
      )}
    </>
  )
}

/** A part preview rendered from the exact same ink ops as the canvas. */
function StencilThumb({ def }: { def: StencilDef }) {
  const ops = stencilInkOps(def, hashString(def.kind))
  const pad = 8
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${def.w + pad * 2} ${def.h + pad * 2}`}
      width="100%"
      height="100%"
      aria-hidden="true"
    >
      <g
        transform={
          def.tilt ? `rotate(${def.tilt} ${def.w / 2} ${def.h / 2})` : undefined
        }
      >
        {ops.map((op, i) =>
          op.t === 'text' ? (
            <text
              key={i}
              x={op.x}
              y={op.y}
              textAnchor="middle"
              fontFamily="Caveat, cursive"
              fontWeight={op.bold ? 700 : 500}
              fontSize={op.size}
              letterSpacing={2}
              fill={INK_COLOR}
            >
              {op.text}
            </text>
          ) : (
            <path
              key={i}
              d={op.d}
              fill={op.t === 'fill' ? INK_COLOR : 'none'}
              stroke={op.t === 'stroke' ? INK_COLOR : 'none'}
              strokeWidth={op.t === 'stroke' ? op.width * 1.4 : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ),
        )}
      </g>
    </svg>
  )
}
