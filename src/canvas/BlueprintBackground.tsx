import { useBlueprintUI } from './BlueprintContext'
import './blueprint-background.css'

/**
 * The blueprint field, painted behind the canvas: a subtle
 * vertical gradient between the two blues, fine paper grain so the blue never
 * reads as a clean digital fill, and — when the user toggles it on — the M5
 * "plate frame": a thin white inset border with corner registration targets.
 *
 * This lives in screen space (fixed to the viewport), so the frame stays put
 * while the canvas pans and zooms underneath it.
 */
export function BlueprintBackground() {
  const { plateFrame } = useBlueprintUI()
  return (
    <div className="bp-bg" aria-hidden="true">
      <div className="bp-bg__grain" />
      {plateFrame && <PlateFrame />}
    </div>
  )
}

/** The thin white border + four corner crosshair-in-circle targets. */
function PlateFrame() {
  const inset = 18
  const target = (cx: number, cy: number) => (
    <g
      stroke="var(--ink)"
      strokeWidth={1.25}
      fill="none"
      opacity={0.7}
      vectorEffect="non-scaling-stroke"
    >
      <circle cx={cx} cy={cy} r={9} />
      <line x1={cx - 14} y1={cy} x2={cx + 14} y2={cy} />
      <line x1={cx} y1={cy - 14} x2={cx} y2={cy + 14} />
    </g>
  )
  return (
    <svg
      className="bp-bg__frame"
      preserveAspectRatio="none"
      // 0..100 viewBox so the rect tracks the viewport; targets use the
      // overlaid pixel layer below for crisp, non-stretched crosshairs.
    >
      <rect
        x={inset}
        y={inset}
        width={`calc(100% - ${inset * 2}px)`}
        height={`calc(100% - ${inset * 2}px)`}
        fill="none"
        stroke="var(--ink)"
        strokeWidth={1.25}
        opacity={0.55}
      />
      {/* Corner targets, positioned with calc against the viewport edges. */}
      <CornerTargets inset={inset} render={target} />
    </svg>
  )
}

function CornerTargets({
  inset,
  render,
}: {
  inset: number
  render: (cx: number, cy: number) => React.ReactNode
}) {
  // SVG can't do calc() inside transform easily; use four nested <svg> with
  // edge anchoring via x/y + percentage so corners stay glued to the viewport.
  const corners: Array<{ x: string; y: string }> = [
    { x: `${inset}px`, y: `${inset}px` },
    { x: `calc(100% - ${inset}px)`, y: `${inset}px` },
    { x: `${inset}px`, y: `calc(100% - ${inset}px)` },
    { x: `calc(100% - ${inset}px)`, y: `calc(100% - ${inset}px)` },
  ]
  return (
    <>
      {corners.map((c, i) => (
        <svg key={i} x={c.x} y={c.y} overflow="visible">
          {render(0, 0)}
        </svg>
      ))}
    </>
  )
}
