import { useEffect, useRef } from 'react'
import { useEditor, useValue } from 'tldraw'

/**
 * Minimal inline text editing for custom shapes. Shows the value as
 * hand-lettered chalk; when the shape is the editing shape, swaps in a
 * transparent textarea bound to the same props. Pointer events are stopped so
 * tldraw doesn't treat typing/selection as canvas gestures.
 */
export function EditableText({
  shapeId,
  value,
  placeholder,
  onChange,
  align = 'center',
  multiline = false,
  fontSize = 24,
  className,
}: {
  shapeId: string
  value: string
  placeholder?: string
  onChange: (next: string) => void
  align?: 'left' | 'center'
  multiline?: boolean
  fontSize?: number
  className?: string
}) {
  const editor = useEditor()
  const editing = useValue(
    'is-editing',
    () => editor.getEditingShapeId() === shapeId,
    [editor, shapeId],
  )
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!editing) return
    const el = ref.current
    if (!el) return
    el.focus()
    el.select()
  }, [editing])

  const shared: React.CSSProperties = {
    font: 'inherit',
    fontFamily: 'var(--font-hand)',
    fontWeight: 500,
    fontSize,
    lineHeight: 1.15,
    color: 'var(--ink)',
    textAlign: align,
    letterSpacing: '0.01em',
  }

  if (editing) {
    return (
      <textarea
        ref={ref}
        className={className}
        value={value}
        rows={multiline ? Math.max(1, value.split('\n').length) : 1}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          // Let Escape bubble so tldraw exits edit mode; keep Enter for
          // multiline blocks, otherwise commit on Enter.
          if (e.key === 'Enter' && !multiline) {
            e.preventDefault()
            editor.setEditingShape(null)
            editor.setSelectedShapes([])
          }
          e.stopPropagation()
        }}
        style={{
          ...shared,
          width: '100%',
          height: '100%',
          margin: 0,
          padding: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          resize: 'none',
          overflow: 'hidden',
          pointerEvents: 'all',
          caretColor: 'var(--ink)',
          whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
        }}
      />
    )
  }

  return (
    <div
      className={className}
      style={{
        ...shared,
        width: '100%',
        whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
        opacity: value ? 1 : 0.5,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {value || placeholder || ''}
    </div>
  )
}
