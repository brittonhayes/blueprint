/**
 * A static hand-drawn suspension-bridge plate for the hero — silver sharpie on
 * the blue field, echoing the Breakstep reference. Rendered as inline SVG so
 * the landing page never has to boot the tldraw bundle. Bloom is applied via
 * the .bp-hero__plate filter in CSS.
 */
export function HeroPlate() {
  const ink = '#c6ccd1'
  const s = {
    fill: 'none',
    stroke: ink,
    strokeWidth: 3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  const thin = { ...s, strokeWidth: 2 }

  // Suspender drop lines from the cable to the deck.
  const suspenders = []
  for (let i = 1; i < 10; i++) {
    const x = 150 + i * 30
    const t = (x - 150) / 300 // 0..1 across the span
    const cableY = 150 + 70 * Math.cos((t - 0.5) * Math.PI) * -1 + 70
    suspenders.push(
      <line key={i} x1={x} y1={cableY} x2={x} y2={232} {...thin} />,
    )
  }

  return (
    <svg viewBox="0 0 600 360" className="bp-hero__svg" role="img" aria-label="Blueprint bridge sketch">
      {/* ground */}
      <path d="M40 300 q150 6 270 4 q180 -2 250 6" {...thin} />

      {/* left tower */}
      <line x1="150" y1="300" x2="150" y2="120" {...s} />
      <line x1="168" y1="300" x2="168" y2="120" {...s} />
      <line x1="150" y1="150" x2="168" y2="150" {...thin} />
      <line x1="150" y1="200" x2="168" y2="200" {...thin} />
      <line x1="150" y1="250" x2="168" y2="250" {...thin} />

      {/* right tower */}
      <line x1="450" y1="300" x2="450" y2="120" {...s} />
      <line x1="432" y1="300" x2="432" y2="120" {...s} />
      <line x1="432" y1="150" x2="450" y2="150" {...thin} />
      <line x1="432" y1="200" x2="450" y2="200" {...thin} />
      <line x1="432" y1="250" x2="450" y2="250" {...thin} />

      {/* main cable */}
      <path d="M70 150 Q159 128 159 128 Q300 280 441 128 Q441 128 530 150" {...s} />

      {/* deck */}
      <path d="M70 232 q230 10 460 0" {...s} />

      {suspenders}

      {/* dimension line */}
      <line x1="150" y1="334" x2="450" y2="334" {...thin} />
      <line x1="150" y1="326" x2="150" y2="342" {...thin} />
      <line x1="450" y1="326" x2="450" y2="342" {...thin} />
      <text x="300" y="329" textAnchor="middle" className="bp-hero__svgtext">
        60 FEET
      </text>

      {/* leader callout */}
      <line x1="470" y1="96" x2="520" y2="96" {...thin} />
      <line x1="470" y1="96" x2="450" y2="130" {...thin} />
      <path d="M450 130 l8 -3 m-8 3 l3 -8" {...thin} />
      <text x="522" y="92" className="bp-hero__svgtext bp-hero__svgtext--left">
        TOWERS 6&apos; TALL
      </text>
    </svg>
  )
}
