import type { Editor } from 'tldraw'

interface ExportOptions {
  glow: boolean
  plateFrame: boolean
}

/**
 * Export the current plate to PNG with the blueprint field and bloom baked in.
 *
 * tldraw's own export only knows about shapes + a flat background color, not
 * our custom React Background, so we composite by hand: render the ink to a
 * transparent PNG, then paint gradient + grain (+ frame) underneath and screen
 * a blurred, brightened copy of the ink over it to reproduce the CSS bloom.
 */
export async function exportPng(editor: Editor, opts: ExportOptions) {
  const ids = Array.from(editor.getCurrentPageShapeIds())
  if (ids.length === 0) return

  const result = await editor.toImage(ids, {
    format: 'png',
    background: false,
    padding: 48,
    pixelRatio: 2,
  })

  const ink = await blobToImage(result.blob)
  const w = ink.naturalWidth
  const h = ink.naturalHeight

  // tldraw exports built-in shapes (pen strokes) in their theme color, which
  // bypasses our live white-ink CSS. Recolor the whole ink layer to the single
  // white by using the export purely as an alpha mask. Custom shapes (already
  // white) are unchanged; dark pen strokes become white.
  const inkWhite = document.createElement('canvas')
  inkWhite.width = w
  inkWhite.height = h
  const wc = inkWhite.getContext('2d')!
  wc.drawImage(ink, 0, 0)
  wc.globalCompositeOperation = 'source-in'
  wc.fillStyle = '#f3f6f8'
  wc.fillRect(0, 0, w, h)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  paintField(ctx, w, h)
  if (opts.plateFrame) paintFrame(ctx, w, h)

  if (opts.glow) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.filter = 'blur(7px) brightness(1.7)'
    ctx.drawImage(inkWhite, 0, 0)
    ctx.filter = 'blur(2px) brightness(1.5)'
    ctx.drawImage(inkWhite, 0, 0)
    ctx.restore()
  }

  // Sharp ink on top.
  ctx.drawImage(inkWhite, 0, 0)

  const out = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!out) return
  downloadBlob(out, 'blueprint.png')
}

function paintField(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#34618d')
  grad.addColorStop(1, '#2c567d')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // Cheap paper grain: scattered faint light/dark specks.
  const count = Math.floor((w * h) / 900)
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w
    const y = Math.random() * h
    const light = Math.random() > 0.5
    ctx.fillStyle = light
      ? 'rgba(255,255,255,0.04)'
      : 'rgba(0,0,0,0.05)'
    ctx.fillRect(x, y, 1.5, 1.5)
  }
}

function paintFrame(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const inset = 40
  ctx.strokeStyle = 'rgba(243,246,248,0.55)'
  ctx.lineWidth = 2
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2)

  ctx.strokeStyle = 'rgba(243,246,248,0.7)'
  const targets: Array<[number, number]> = [
    [inset, inset],
    [w - inset, inset],
    [inset, h - inset],
    [w - inset, h - inset],
  ]
  const r = 16
  const arm = 26
  for (const [cx, cy] of targets) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.moveTo(cx - arm, cy)
    ctx.lineTo(cx + arm, cy)
    ctx.moveTo(cx, cy - arm)
    ctx.lineTo(cx, cy + arm)
    ctx.stroke()
  }
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
