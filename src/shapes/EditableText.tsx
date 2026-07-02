import { useEffect, useRef } from 'react'

/**
 * Minimal inline text editing for shape labels.
 *
 * Shows the value as hand-lettered silver ink; when `editing`, swaps in a
 * transparent textarea bound to the same value. Pointer events are stopped so
 * the canvas doesn't treat typing or selection as a drawing gesture.
 */
export function EditableText({
  value,
  placeholder,
  editing,
  onChange,
  onCommit,
  align = 'center',
  multiline = false,
  fontSize = 24,
}: {
  value: string
  placeholder?: string
  editing: boolean
  onChange: (next: string) => void
  onCommit: () => void
  align?: 'left' | 'center'
  multiline?: boolean
  fontSize?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!editing) return
    // Focus after the current pointer gesture settles: focusing mid-pointerdown
    // (as when a text shape is created by a click) can bounce straight back to
    // the body, so we defer a frame and let the textarea keep focus.
    const raf = requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      el.focus({ preventScroll: true })
      el.select()
    })
    return () => cancelAnimationFrame(raf)
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
        value={value}
        rows={multiline ? Math.max(1, value.split('\n').length) : 1}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || (e.key === 'Enter' && !multiline)) {
            e.preventDefault()
            onCommit()
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
