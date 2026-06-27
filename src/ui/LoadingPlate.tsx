import './loading.css'

/** Shown while the editor bundle loads. A quiet glowing wordmark. */
export function LoadingPlate() {
  return (
    <div className="bp-loading">
      <div className="bp-loading__mark">BLUEPRINT</div>
      <div className="bp-loading__sub">priming the plate…</div>
    </div>
  )
}
