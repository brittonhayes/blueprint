import { useState } from 'react'
import { useEditor, useValue } from '../canvas/react'
import { clearPage } from '../lib/editorActions'
import {
  PenIcon,
  EraserIcon,
  TextIcon,
  SelectIcon,
  UndoIcon,
  RedoIcon,
  TrashIcon,
} from './icons'
import './dock.css'

/** The three sharpie nibs: fine, standard, broad (world px). */
const NIBS = [
  { size: 3, label: 'Fine nib' },
  { size: 5, label: 'Standard nib' },
  { size: 9, label: 'Broad nib' },
]

export function Dock() {
  const editor = useEditor()
  const toolId = useValue('tool', () => editor.getCurrentToolId(), [editor])
  const strokeSize = useValue('stroke-size', () => editor.getStrokeSize(), [editor])
  const [confirmClear, setConfirmClear] = useState(false)

  return (
    <div className="bp-dock-wrap" role="toolbar" aria-label="Drawing tools">
      <div className="bp-dock glass">
        <DockButton
          label="Sharpie (D)"
          active={toolId === 'draw'}
          onClick={() => editor.setCurrentTool('draw')}
        >
          <PenIcon />
        </DockButton>

        {toolId === 'draw' && (
          <div className="bp-dock__nibs" role="group" aria-label="Nib size">
            {NIBS.map((nib) => (
              <button
                key={nib.size}
                type="button"
                className={`bp-dock__nib${strokeSize === nib.size ? ' is-active' : ''}`}
                aria-label={nib.label}
                aria-pressed={strokeSize === nib.size}
                title={nib.label}
                onClick={() => editor.setStrokeSize(nib.size)}
              >
                <span
                  className="bp-dock__nib-dot"
                  style={{ width: nib.size + 3, height: nib.size + 3 }}
                />
              </button>
            ))}
          </div>
        )}

        <DockButton
          label="Eraser (E)"
          active={toolId === 'eraser'}
          onClick={() => editor.setCurrentTool('eraser')}
        >
          <EraserIcon />
        </DockButton>
        <DockButton
          label="Text (T)"
          active={toolId === 'text'}
          onClick={() => editor.setCurrentTool('text')}
        >
          <TextIcon />
        </DockButton>
        <DockButton
          label="Select (V)"
          active={toolId === 'select'}
          onClick={() => editor.setCurrentTool('select')}
        >
          <SelectIcon />
        </DockButton>

        <span className="bp-dock__divider" aria-hidden="true" />

        <DockButton label="Undo (Ctrl+Z)" onClick={() => editor.undo()}>
          <UndoIcon />
        </DockButton>
        <DockButton label="Redo (Ctrl+Shift+Z)" onClick={() => editor.redo()}>
          <RedoIcon />
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
      </div>
    </div>
  )
}

function DockButton({
  label,
  children,
  onClick,
  active,
  pressed,
  disabled,
}: {
  label: string
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  pressed?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`bp-dock__btn${active ? ' is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
    >
      {children}
    </button>
  )
}
