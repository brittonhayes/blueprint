import { useState, useCallback } from 'react'
import { Tldraw, type Editor as TLEditor, useEditor, useValue } from 'tldraw'
import 'tldraw/tldraw.css'

import '../canvas/blueprint-ink.css'
import '../bloom/bloom.css'
import './editor.css'
import { blueprintComponents } from '../canvas/components'
import { blueprintAssetUrls } from '../canvas/assetUrls'
import { customShapeUtils } from '../shapes'
import { configureEditor } from '../lib/editorActions'
import { BlueprintUIContext } from '../canvas/BlueprintContext'
import { Dock } from '../ui/Dock'
import { TopBar } from '../ui/TopBar'

const PERSISTENCE_KEY = 'blueprint-default'

export function Editor() {
  const [glow, setGlow] = useState(true)
  const [plateFrame, setPlateFrame] = useState(false)

  const onMount = useCallback((editor: TLEditor) => {
    configureEditor(editor)
  }, [])

  return (
    <BlueprintUIContext.Provider value={{ glow, setGlow, plateFrame, setPlateFrame }}>
      <div className="bp-editor" data-glow={glow} style={{ position: 'fixed', inset: 0 }}>
        <Tldraw
          persistenceKey={PERSISTENCE_KEY}
          shapeUtils={customShapeUtils}
          components={blueprintComponents}
          assetUrls={blueprintAssetUrls}
          onMount={onMount}
        >
          <TopBar />
          <EmptyStatePrompt />
          <Dock />
        </Tldraw>
      </div>
    </BlueprintUIContext.Provider>
  )
}

/** A faint hand-lettered invitation that clears the moment a shape exists. */
function EmptyStatePrompt() {
  const editor = useEditor()
  const isEmpty = useValue(
    'is-empty',
    () => editor.getCurrentPageShapeIds().size === 0,
    [editor],
  )
  if (!isEmpty) return null
  return (
    <div className="bp-empty" aria-hidden="true">
      draw your first line
    </div>
  )
}
