import { createContext, useContext } from 'react'

/**
 * Shared chrome state for the editor. tldraw renders our custom components
 * (Background, etc.) inside the React tree below this provider, so both the
 * dock controls and the canvas-internal components can read the same flags.
 */
export interface BlueprintUIState {
  glow: boolean
  setGlow: (v: boolean) => void
  plateFrame: boolean
  setPlateFrame: (v: boolean) => void
}

export const BlueprintUIContext = createContext<BlueprintUIState | null>(null)

export function useBlueprintUI(): BlueprintUIState {
  const ctx = useContext(BlueprintUIContext)
  if (!ctx) {
    // Safe default so the Background never crashes if rendered standalone.
    return {
      glow: true,
      setGlow: () => {},
      plateFrame: false,
      setPlateFrame: () => {},
    }
  }
  return ctx
}
