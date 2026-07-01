import { createContext, useContext } from 'react'

/**
 * Shared chrome state for the editor. The background, dock, and canvas all sit
 * inside the React tree below this provider, so they read the same flags.
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
