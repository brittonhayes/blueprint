/**
 * Measure hand-lettered text so shapes can compute their own bounds without a
 * live DOM node. Uses one shared offscreen 2D context with the same Caveat face
 * the canvas renders in, so selection boxes and hit-testing line up with what
 * the user sees.
 */
let ctx: CanvasRenderingContext2D | null = null

function context(): CanvasRenderingContext2D {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d')
  return ctx!
}

export function measureText(
  text: string,
  fontSize: number,
): { w: number; h: number } {
  const c = context()
  c.font = `500 ${fontSize}px "Caveat", "Comic Sans MS", cursive`
  const lines = text.split('\n')
  let w = 0
  for (const line of lines) w = Math.max(w, c.measureText(line || ' ').width)
  return { w: Math.ceil(w), h: Math.ceil(lines.length * fontSize * 1.15) }
}
