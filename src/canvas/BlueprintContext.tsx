import { createContext, useContext } from 'react'

/**
 * Shared chrome state for the editor. The background, dock, and canvas all sit
 * inside the React tree below this provider, so they read the same flags.
 */
export interface BlueprintUIState {
  glow: boolean
}

export const BlueprintUIContext = createContext<BlueprintUIState | null>(null)

export function useBlueprintUI(): BlueprintUIState {
  const ctx = useContext(BlueprintUIContext)
  if (!ctx) {
    // Safe default so consumers never crash if rendered standalone.
    return { glow: true }
  }
  return ctx
}
