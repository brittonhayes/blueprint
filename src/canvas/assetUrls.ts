import type { TLEditorAssetUrls } from 'tldraw'
import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite'
import { CAVEAT_URL, INTER_URL } from '../assets/fonts'

/**
 * Self-host every tldraw asset.
 *
 * By default tldraw pulls icons, translations, embed icons, and fonts from
 * cdn.tldraw.com. We bundle them locally via Vite (`getAssetUrlsByImport`) so
 * the GitHub Pages site is fully self-contained — no CDN dependency, no console
 * errors behind strict networks, and correct font embedding in exports.
 *
 * Then we override the font slots: draw fonts become Caveat (the handwritten
 * personality); the quiet sans/serif/mono slots fall back to Inter (only used
 * by the chrome we mostly hide).
 */
const CAVEAT = CAVEAT_URL
const INTER = INTER_URL

const base = getAssetUrlsByImport()

export const blueprintAssetUrls: TLEditorAssetUrls = {
  ...base,
  fonts: {
    ...base.fonts,
    tldraw_draw: CAVEAT,
    tldraw_draw_bold: CAVEAT,
    tldraw_draw_italic: CAVEAT,
    tldraw_draw_italic_bold: CAVEAT,
    tldraw_sans: INTER,
    tldraw_sans_bold: INTER,
    tldraw_sans_italic: INTER,
    tldraw_sans_italic_bold: INTER,
    tldraw_serif: INTER,
    tldraw_serif_bold: INTER,
    tldraw_serif_italic: INTER,
    tldraw_serif_italic_bold: INTER,
    tldraw_mono: INTER,
    tldraw_mono_bold: INTER,
    tldraw_mono_italic: INTER,
    tldraw_mono_italic_bold: INTER,
  },
}
