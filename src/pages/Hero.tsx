import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { HeroPlate } from './HeroPlate'
import './hero.css'

export function Hero() {
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)

  const start = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      navigate('/draft')
      return
    }
    // Brief zoom-in before handing off to the editor route.
    setLeaving(true)
    window.setTimeout(() => navigate('/draft'), 360)
  }

  return (
    <main className={`bp-hero${leaving ? ' is-leaving' : ''}`}>
      <div className="bp-hero__grain" aria-hidden="true" />
      <div className="bp-hero__inner">
        <div className="bp-hero__plate" aria-hidden="true">
          <HeroPlate />
        </div>

        <h1 className="bp-hero__mark">BLUEPRINT</h1>
        <p className="bp-hero__line">
          Sketch architecture and engineering plates in glowing silver sharpie
          on blueprint blue.
        </p>
        <button className="bp-hero__cta" onClick={start}>
          Start a plate
        </button>
      </div>
    </main>
  )
}
