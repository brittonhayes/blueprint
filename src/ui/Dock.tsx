import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, useValue } from '../canvas/react'
import { useBlueprintUI } from '../canvas/BlueprintContext'
import { insertCustomShape, clearPage } from '../lib/editorActions'
import { exportPng } from '../export/exportPng'
import {
  PenIcon,
  EraserIcon,
  TextIcon,
  DiagramIcon,
  UndoIcon,
  TrashIcon,
  GlowIcon,
  ExportIcon,
  DimensionIcon,
  LeaderIcon,
  ListIcon,
} from './icons'
import './dock.css'

export function Dock() {
  const editor = useEditor()
  const { glow, setGlow, plateFrame, setPlateFrame } = useBlueprintUI()
  const toolId = useValue('tool', () => editor.getCurrentToolId(), [editor])
  const [diagramOpen, setDiagramOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [exporting, setExporting] = useState(false)
  const diagramBtnRef = useRef<HTMLButtonElement>(null)

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportPng(editor, { glow, plateFrame })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="bp-dock-wrap" role="toolbar" aria-label="Drawing tools">
      <div className="bp-dock glass">
        <DockButton
          label="Pen"
          active={toolId === 'draw'}
          onClick={() => editor.setCurrentTool('draw')}
        >
          <PenIcon />
        </DockButton>
        <DockButton
          label="Eraser"
          active={toolId === 'eraser'}
          onClick={() => editor.setCurrentTool('eraser')}
        >
          <EraserIcon />
        </DockButton>
        <DockButton
          label="Text"
          active={toolId === 'text'}
          onClick={() => editor.setCurrentTool('text')}
        >
          <TextIcon />
        </DockButton>

        <span className="bp-dock__divider" aria-hidden="true" />

        <div className="bp-dock__popwrap">
          <DockButton
            ref={diagramBtnRef}
            label="Diagram shapes"
            active={diagramOpen}
            expanded={diagramOpen}
            onClick={() => setDiagramOpen((v) => !v)}
          >
            <DiagramIcon />
          </DockButton>
          {diagramOpen && (
            <DiagramPopover
              anchor={diagramBtnRef.current}
              onPick={(type) => {
                insertCustomShape(editor, type)
                setDiagramOpen(false)
              }}
              onClose={() => setDiagramOpen(false)}
            />
          )}
        </div>

        <span className="bp-dock__divider" aria-hidden="true" />

        <DockButton label="Undo" onClick={() => editor.undo()}>
          <UndoIcon />
        </DockButton>

        {confirmClear ? (
          <div className="bp-dock__confirm" role="group" aria-label="Confirm clear">
            <button
              className="bp-confirm-yes"
              onClick={() => {
                clearPage(editor)
                setConfirmClear(false)
              }}
            >
              Clear all
            </button>
            <button
              className="bp-confirm-no"
              onClick={() => setConfirmClear(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <DockButton label="Clear" onClick={() => setConfirmClear(true)}>
            <TrashIcon />
          </DockButton>
        )}

        <span className="bp-dock__divider" aria-hidden="true" />

        <DockButton
          label="Glow"
          pressed={glow}
          active={glow}
          onClick={() => setGlow(!glow)}
        >
          <GlowIcon />
        </DockButton>
        <DockButton
          label="Plate frame"
          pressed={plateFrame}
          active={plateFrame}
          onClick={() => setPlateFrame(!plateFrame)}
        >
          <FrameGlyph />
        </DockButton>

        <DockButton
          label={exporting ? 'Exporting…' : 'Export'}
          onClick={handleExport}
          disabled={exporting}
        >
          <ExportIcon />
        </DockButton>
      </div>
    </div>
  )
}

function DockButton({
  ref,
  label,
  children,
  onClick,
  active,
  pressed,
  expanded,
  disabled,
}: {
  ref?: React.Ref<HTMLButtonElement>
  label: string
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  pressed?: boolean
  expanded?: boolean
  disabled?: boolean
}) {
  return (
    <button
      ref={ref}
      type="button"
      className={`bp-dock__btn${active ? ' is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      title={label}
    >
      {children}
    </button>
  )
}

function DiagramPopover({
  anchor,
  onPick,
  onClose,
}: {
  anchor: HTMLElement | null
  onPick: (type: 'dimension-line' | 'leader-callout' | 'part-list') => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        !anchor?.contains(e.target as Node)
      )
        onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose, anchor])

  // Position fixed above the anchor button; portal to body so the dock's
  // horizontal scroll never clips us.
  const rect = anchor?.getBoundingClientRect()
  const style: React.CSSProperties = rect
    ? {
        position: 'fixed',
        left: rect.left + rect.width / 2,
        bottom: window.innerHeight - rect.top + 10,
        transform: 'translateX(-50%)',
      }
    : { display: 'none' }

  return createPortal(
    <div
      className="bp-popover glass"
      ref={ref}
      role="menu"
      aria-label="Diagram shapes"
      style={style}
    >
      <button className="bp-popover__item" role="menuitem" onClick={() => onPick('dimension-line')}>
        <DimensionIcon />
        <span>Dimension line</span>
      </button>
      <button className="bp-popover__item" role="menuitem" onClick={() => onPick('leader-callout')}>
        <LeaderIcon />
        <span>Leader callout</span>
      </button>
      <button className="bp-popover__item" role="menuitem" onClick={() => onPick('part-list')}>
        <ListIcon />
        <span>Part list</span>
      </button>
    </div>,
    document.body,
  )
}

function FrameGlyph() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <circle cx="4" cy="4" r="1.6" />
      <circle cx="20" cy="4" r="1.6" />
      <circle cx="4" cy="20" r="1.6" />
      <circle cx="20" cy="20" r="1.6" />
    </svg>
  )
}
