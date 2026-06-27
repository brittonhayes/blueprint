import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useEditor } from 'tldraw'
import { useBlueprintUI } from '../canvas/BlueprintContext'
import { exportPng } from '../export/exportPng'
import { ExportIcon } from './icons'
import './topbar.css'

export function TopBar() {
  const editor = useEditor()
  const { glow, plateFrame } = useBlueprintUI()
  const [exporting, setExporting] = useState(false)

  const onExport = async () => {
    setExporting(true)
    try {
      await exportPng(editor, { glow, plateFrame })
    } finally {
      setExporting(false)
    }
  }

  return (
    <header className="bp-topbar">
      <Link to="/" className="bp-topbar__brand" aria-label="BLUEPRINT — home">
        BLUEPRINT
      </Link>
      <div className="bp-topbar__title" aria-hidden="true">
        Untitled plate
      </div>
      <button
        className="bp-topbar__export glass"
        onClick={onExport}
        disabled={exporting}
      >
        <ExportIcon size={17} />
        <span>{exporting ? 'Exporting…' : 'Export'}</span>
      </button>
    </header>
  )
}
