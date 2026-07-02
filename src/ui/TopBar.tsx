import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useEditor } from '../canvas/react'
import { useBlueprintUI } from '../canvas/BlueprintContext'
import { exportPng } from '../export/exportPng'
import { loadTitle, saveTitle, titleToFilename, DEFAULT_TITLE } from '../lib/plateTitle'
import { DownloadIcon } from './icons'
import './topbar.css'

export function TopBar() {
  const editor = useEditor()
  const { glow } = useBlueprintUI()
  const [exporting, setExporting] = useState(false)
  const [title, setTitle] = useState(loadTitle)

  const onTitleChange = (next: string) => {
    setTitle(next)
    saveTitle(next)
  }

  const onExport = async () => {
    setExporting(true)
    try {
      await exportPng(editor, {
        glow,
        filename: titleToFilename(title),
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <header className="bp-topbar">
      <Link to="/" className="bp-topbar__brand" aria-label="BLUEPRINT — home">
        BLUEPRINT
      </Link>
      <input
        className="bp-topbar__title"
        value={title}
        placeholder={DEFAULT_TITLE}
        aria-label="Plate title"
        spellCheck={false}
        onChange={(e) => onTitleChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
          e.stopPropagation()
        }}
      />
      <button
        className="bp-topbar__export glass"
        onClick={onExport}
        disabled={exporting}
        aria-label={exporting ? 'Saving…' : 'Save PNG'}
        title="Save PNG"
      >
        <DownloadIcon size={19} />
      </button>
    </header>
  )
}
