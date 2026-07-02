import type { BlueprintEditor } from '../canvas/editor'
import { unionBounds } from '../canvas/geometry'
import { getShapeDef } from '../shapes'
import { CAVEAT_URL } from '../assets/fonts'
import type { Bounds } from '../canvas/types'

interface ExportOptions {
  glow: boolean
  plateFrame: boolean
}

const PAD = 48
const RATIO = 2

/**
 * Export the current plate to PNG with the blueprint field and bloom baked in.
 *
 * We render the ink ourselves: serialise every shape to SVG (with the Caveat
 * face embedded so labels export faithfully), rasterise it to a transparent
 * layer, then paint gradient + grain (+ frame) underneath and screen a blurred,
 * brightened copy of the ink over it to reproduce the live CSS bloom.
 */
export async function exportPng(editor: BlueprintEditor, opts: ExportOptions) {
  const shapes = editor.getShapes()
  if (shapes.length === 0) return

  const worldBounds: Bounds[] = shapes.map((s) => {
    const b = getShapeDef(s.type).getBounds(s)
    return { x: s.x + b.x, y: s.y + b.y, w: b.w, h: b.h }
  })
  const union = unionBounds(worldBounds)
  if (!union) return

  const x0 = union.x - PAD
  const y0 = union.y - PAD
  const w = Math.ceil(union.w + PAD * 2)
  const h = Math.ceil(union.h + PAD * 2)
  const W = w * RATIO
  const H = h * RATIO

  const body = shapes
    .map(
      (s) =>
        `<g transform="translate(${(s.x - x0).toFixed(2)} ${(s.y - y0).toFixed(2)})">` +
        `${getShapeDef(s.type).toExportSvg(s)}</g>`,
    )
    .join('')

  const fontCss = await fontFaceCss()
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${w} ${h}">` +
    `<defs><style>${fontCss}</style></defs>${body}</svg>`

  const ink = await svgToImage(svg)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  paintField(ctx, W, H)
  if (opts.plateFrame) paintFrame(ctx, W, H)

  if (opts.glow) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.filter = 'blur(7px) brightness(1.7)'
    ctx.drawImage(ink, 0, 0)
    ctx.filter = 'blur(2px) brightness(1.5)'
    ctx.drawImage(ink, 0, 0)
    ctx.restore()
  }

  // Sharp ink on top.
  ctx.drawImage(ink, 0, 0)

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
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'
    ctx.fillRect(x, y, 1.5, 1.5)
  }
}

function paintFrame(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const inset = 40
  ctx.strokeStyle = 'rgba(198,204,209,0.55)'
  ctx.lineWidth = 2
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2)

  ctx.strokeStyle = 'rgba(198,204,209,0.7)'
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

let fontCssPromise: Promise<string> | null = null
/** Inline the Caveat woff2 as a base64 @font-face so exported text renders. */
function fontFaceCss(): Promise<string> {
  if (!fontCssPromise) {
    fontCssPromise = fetch(CAVEAT_URL)
      .then((r) => r.arrayBuffer())
      .then(
        (buf) =>
          `@font-face{font-family:'Caveat';font-style:normal;font-weight:400 700;` +
          `src:url(data:font/woff2;base64,${toBase64(buf)}) format('woff2');}`,
      )
      .catch(() => '')
  }
  return fontCssPromise
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function svgToImage(svg: string): Promise<HTMLImageElement> {
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  return new Promise((resolve, reject) => {
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
