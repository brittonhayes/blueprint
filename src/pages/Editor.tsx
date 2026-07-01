import { useState, useMemo, useEffect } from 'react'

import '../canvas/blueprint-ink.css'
import '../bloom/bloom.css'
import './editor.css'
import { BlueprintEditor } from '../canvas/editor'
import { EditorProvider, useEditor, useValue } from '../canvas/react'
import { Canvas } from '../canvas/Canvas'
import { BlueprintBackground } from '../canvas/BlueprintBackground'
import { BlueprintUIContext } from '../canvas/BlueprintContext'
import { Dock } from '../ui/Dock'
import { TopBar } from '../ui/TopBar'

const PERSISTENCE_KEY = 'blueprint-default'

export function Editor() {
  const [glow, setGlow] = useState(true)
  const [plateFrame, setPlateFrame] = useState(false)

  // One editor instance for the lifetime of the route; load saved plate once.
  const editor = useMemo(() => {
    const ed = new BlueprintEditor()
    ed.loadPersistence(PERSISTENCE_KEY)
    return ed
  }, [])

  // Persist the plate immediately when the tab is hidden or closed, so a fast
  // reload never loses the last few strokes waiting on the save debounce.
  useEffect(() => {
    const flush = () => editor.flush()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') editor.flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      editor.flush()
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [editor])

  return (
    <BlueprintUIContext.Provider value={{ glow, setGlow, plateFrame, setPlateFrame }}>
      <EditorProvider editor={editor}>
        <div className="bp-editor" data-glow={glow} style={{ position: 'fixed', inset: 0 }}>
          <BlueprintBackground />
          <Canvas />
          <TopBar />
          <EmptyStatePrompt />
          <Dock />
        </div>
      </EditorProvider>
    </BlueprintUIContext.Provider>
  )
}

/** A faint hand-lettered invitation that clears the moment a shape exists. */
function EmptyStatePrompt() {
  const editor = useEditor()
  const isEmpty = useValue('is-empty', () => editor.isEmpty(), [editor])
  if (!isEmpty) return null
  return (
    <div className="bp-empty" aria-hidden="true">
      draw your first line
    </div>
  )
}
