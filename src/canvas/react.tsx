import { createContext, useContext, useEffect, useState } from 'react'
import type { BlueprintEditor } from './editor'

/**
 * React bindings for {@link BlueprintEditor}.
 *
 * These re-create the tiny slice of tldraw's API the chrome was written
 * against — `useEditor()` and `useValue(name, compute, deps)` — so the dock,
 * top bar, and shape editors keep reading exactly as before.
 */
const EditorContext = createContext<BlueprintEditor | null>(null)

export function EditorProvider({
  editor,
  children,
}: {
  editor: BlueprintEditor
  children: React.ReactNode
}) {
  return (
    <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>
  )
}

export function useEditor(): BlueprintEditor {
  const editor = useContext(EditorContext)
  if (!editor) throw new Error('useEditor must be used within an EditorProvider')
  return editor
}

/**
 * Subscribe to a derived value from the editor and re-render when it changes.
 * `compute` runs on every editor change; the result is compared with `Object.is`
 * so unrelated updates don't churn the component.
 */
export function useValue<T>(
  _name: string,
  compute: () => T,
  deps: unknown[],
): T {
  const editor = useEditor()
  const [value, setValue] = useState<T>(compute)

  useEffect(() => {
    const update = () =>
      setValue((prev) => {
        const next = compute()
        return Object.is(prev, next) ? prev : next
      })
    update()
    return editor.subscribe(update)
    // `compute` is intentionally excluded — callers pass its dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, ...deps])

  return value
}
