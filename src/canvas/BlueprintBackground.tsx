import './blueprint-background.css'

/**
 * The blueprint field, painted behind the canvas: a subtle vertical gradient
 * between the two blues, and fine paper grain so the blue never reads as a
 * clean digital fill.
 *
 * This lives in screen space (fixed to the viewport), so the field stays put
 * while the canvas pans and zooms underneath it.
 */
export function BlueprintBackground() {
  return (
    <div className="bp-bg" aria-hidden="true">
      <div className="bp-bg__grain" />
    </div>
  )
}
