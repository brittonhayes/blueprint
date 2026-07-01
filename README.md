# BLUEPRINT

Sketch architecture and engineering plates in glowing silver sharpie on blueprint
blue. A small, opinionated drafting surface in the style of the original M5
Industries / MythBusters plates, with a soft mid‑2000s broadcast bloom.

Built on a small, self-contained canvas editor — no drawing SDK, no license
key — with a branded dock and top bar.

![A glowing blueprint sketch of a suspension bridge](docs/hero.png)

## What it does

- **Silver‑sharpie drawing** on a grained blueprint‑blue field — pressure‑aware
  freehand, no grid, no color picker (silver only).
- **Diagram primitives** that keep the hand‑drawn look but behave like real
  vector shapes: a **dimension line** (end ticks + editable measurement), a
  **leader callout** (label + arrow to a draggable target), and a **numbered
  part list** (titled block with inline add/remove rows). Typed labels render in
  the handwritten Caveat face.
- **Bloom** — a live CSS‑filter glow (the only glow source), toggleable, and
  baked into PNG export.
- **Plate frame** — an optional thin white border with corner registration
  targets, for the full M5 plate look.
- **Export** — client‑side PNG (`blueprint.png`) with the blue field, ink, and
  bloom composited in.
- **Auto‑save** to the browser via `localStorage`; reload‑safe.

## Tech

React + TypeScript + Vite, `HashRouter`. The drafting surface is a purpose‑built
canvas editor: a flat list of shapes rendered into a single camera‑transformed
layer, with its own pointer hit‑testing, undo history, and a small
pressure‑aware freehand engine. No third‑party drawing SDK. Fonts (Caveat,
Inter) are self‑hosted — the site has no runtime CDN dependency.

```
src/
  pages/        Hero (landing) and Editor (lazy-loaded canvas route)
  canvas/       editor store, React bindings, canvas + shape views,
                camera/geometry, freehand engine, blueprint field
  shapes/       shape defs (geometry, render, export): draw, text, dimension
                line, leader callout, part list
  ui/           floating dock, top bar, icons
  bloom/        CSS-filter bloom
  export/       PNG export with bloom + field baked in
```

## Develop

```bash
npm install
npm run dev        # http://localhost:5173/blueprint/
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build
```

## Deploy (GitHub Pages)

The repo ships a workflow at `.github/workflows/deploy.yml` that builds and
publishes `dist/` to Pages. To enable it:

1. In the repo, go to **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Push to `main` (or run the workflow manually). The site publishes at
   `https://brittonhayes.github.io/blueprint/`.

The Vite `base` is `/blueprint/` to match the project‑pages path. For a
custom domain or a different path, set `BASE_PATH` when building, e.g.
`BASE_PATH=/ npm run build`.

## Notes

- Keyboard shortcuts: `d` pen, `e` eraser, `t` text, `v` select; `⌘/Ctrl+Z`
  undo, `⇧⌘/Ctrl+Z` (or `Ctrl+Y`) redo; `Delete` removes the selection. Hold
  `Space` to pan; scroll/pinch to pan and zoom.
