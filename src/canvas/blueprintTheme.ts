/**
 * Silver-only ink.
 *
 * tldraw v5 resolves shape colors through an internal theme system with no
 * public palette to rewrite, so instead of fighting per-shape we force silver
 * at the CSS layer (see blueprint-ink.css). That stylesheet only touches the
 * built-in `draw` and `text` shapes — the only color-bearing built-ins we
 * expose. Our custom shapes render their own inline silver SVG inside an
 * HTMLContainer, so they're never caught by the override.
 *
 * These constants are the single source of truth for custom-shape rendering.
 */
export const INK_COLOR = '#c6ccd1'
export const INK_COLOR_SEMI = 'rgba(198, 204, 209, 0.16)'
export const INK_COLOR_FAINT = 'rgba(198, 204, 209, 0.5)'
