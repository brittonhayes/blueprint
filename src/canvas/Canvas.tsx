import { useCallback, useEffect, useRef } from 'react'
import { useEditor, useValue } from './react'
import { getShapeDef } from '../shapes'
import { createShapeId } from './editor'
import { dist } from './geometry'
import type { DrawShape, Shape, StrokePoint, Vec } from './types'
import { ShapeView } from './ShapeView'
import { getStrokePath } from './freehand'
import { INK_COLOR } from './blueprintTheme'

const DRAW_SIZE = 5
const HANDLE_HIT = 12

/**
 * The interactive drafting surface.
 *
 * Owns all pointer/keyboard/wheel interaction — freehand drawing, erasing,
 * placing text, selecting/moving shapes, dragging handles, and panning/zooming
 * the camera (wheel, trackpad pinch, and two-finger touch). Shapes render into a
 * single camera-transformed layer; the container does its own hit-testing, so no
 * drawing SDK is involved.
 */

type Gesture =
  | { mode: 'idle' }
  | { mode: 'draw'; points: StrokePoint[] }
  | { mode: 'pan'; lastX: number; lastY: number }
  | { mode: 'move'; id: string; grabWorld: Vec; startX: number; startY: number; marked: boolean }
  | { mode: 'handle'; id: string; handleId: string; marked: boolean }
  | { mode: 'erase'; marked: boolean }
  | { mode: 'pinch' }

export function Canvas() {
  const editor = useEditor()
  const containerRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture>({ mode: 'idle' })
  const pointers = useRef<Map<number, Vec>>(new Map())
  const pinchBase = useRef<{ dist: number; mid: Vec } | null>(null)
  const spaceHeld = useRef(false)
  const drawPreviewRef = useRef<SVGPathElement>(null)

  const shapes = useValue('shapes', () => editor.getShapes(), [editor])
  const camera = useValue('camera', () => editor.getCamera(), [editor])
  const tool = useValue('tool', () => editor.getCurrentToolId(), [editor])
  const selectedId = useValue('selected', () => editor.getSelectedId(), [editor])
  const editingId = useValue('editing', () => editor.getEditingShapeId(), [editor])

  // Keep the editor's viewport size in sync for centering + zoom math.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const sync = () => editor.setViewport(el.clientWidth, el.clientHeight)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [editor])

  // Global keyboard: tools, undo/redo, delete, escape, space-to-pan.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if (e.key === ' ') {
        spaceHeld.current = true
        return
      }
      const mod = e.metaKey || e.ctrlKey
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) editor.redo()
        else editor.undo()
        return
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        editor.redo()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const id = editor.getSelectedId()
        if (id && editor.getEditingShapeId() !== id) {
          e.preventDefault()
          editor.deleteShapes([id])
        }
        return
      }
      if (e.key === 'Escape') {
        editor.setEditingShape(null)
        editor.select(null)
        return
      }
      switch (e.key) {
        case 'd':
          editor.setCurrentTool('draw')
          break
        case 'e':
          editor.setCurrentTool('eraser')
          break
        case 't':
          editor.setCurrentTool('text')
          break
        case 'v':
          editor.setCurrentTool('select')
          break
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') spaceHeld.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [editor])

  const getScreen = useCallback((e: React.PointerEvent): Vec => {
    const rect = containerRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  /** Topmost shape hit by a world-space point, or null. */
  const hitShape = useCallback(
    (world: Vec): Shape | null => {
      const list = editor.getShapes()
      for (let i = list.length - 1; i >= 0; i--) {
        const s = list[i]
        const def = getShapeDef(s.type)
        if (def.hitTest(s, { x: world.x - s.x, y: world.y - s.y })) return s
      }
      return null
    },
    [editor],
  )

  const updatePreview = useCallback((points: StrokePoint[]) => {
    if (drawPreviewRef.current) {
      drawPreviewRef.current.setAttribute('d', getStrokePath(points, { size: DRAW_SIZE }))
    }
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Ignore synthetic pointerdowns from within editing fields (they stop
      // propagation), and right-clicks.
      if (e.button === 2) return
      const el = containerRef.current!
      el.setPointerCapture(e.pointerId)
      const screen = getScreen(e)
      pointers.current.set(e.pointerId, screen)

      // Second finger down → pinch-zoom/pan; abandon any in-progress stroke.
      if (pointers.current.size === 2) {
        const pts = [...pointers.current.values()]
        pinchBase.current = {
          dist: dist(pts[0], pts[1]),
          mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
        }
        gesture.current = { mode: 'pinch' }
        updatePreview([])
        return
      }

      // Commit any open text edit before starting a new gesture.
      if (editor.getEditingShapeId()) editor.setEditingShape(null)

      const world = editor.screenToWorld(screen)

      // Space or middle-button always pans.
      if (spaceHeld.current || e.button === 1) {
        gesture.current = { mode: 'pan', lastX: screen.x, lastY: screen.y }
        return
      }

      const currentTool = editor.getCurrentToolId()

      if (currentTool === 'draw') {
        const pt: StrokePoint = { x: world.x, y: world.y, p: e.pressure || 0.5 }
        gesture.current = { mode: 'draw', points: [pt] }
        updatePreview([pt])
        return
      }

      if (currentTool === 'eraser') {
        gesture.current = { mode: 'erase', marked: false }
        eraseAt(world)
        return
      }

      if (currentTool === 'text') {
        const id = createShapeId('text')
        editor.createShape({ id, type: 'text', x: world.x, y: world.y - 14, text: '', fontSize: 28 })
        editor.setCurrentTool('select')
        editor.setEditingShape(id)
        gesture.current = { mode: 'idle' }
        return
      }

      // select tool ----------------------------------------------------
      const selId = editor.getSelectedId()
      if (selId) {
        const sel = editor.getShape(selId)
        const def = sel && getShapeDef(sel.type)
        if (sel && def?.getHandles) {
          for (const h of def.getHandles(sel)) {
            const hs = editor.worldToScreen({ x: sel.x + h.x, y: sel.y + h.y })
            if (dist(hs, screen) <= HANDLE_HIT) {
              gesture.current = { mode: 'handle', id: sel.id, handleId: h.id, marked: false }
              return
            }
          }
        }
      }

      const hit = hitShape(world)
      if (hit) {
        editor.select(hit.id)
        gesture.current = {
          mode: 'move',
          id: hit.id,
          grabWorld: world,
          startX: hit.x,
          startY: hit.y,
          marked: false,
        }
      } else {
        editor.select(null)
        gesture.current = { mode: 'idle' }
      }
    },
    [editor, getScreen, hitShape, updatePreview],
  )

  const eraseAt = useCallback(
    (world: Vec) => {
      const hit = hitShape(world)
      if (!hit) return
      const g = gesture.current
      if (g.mode === 'erase' && !g.marked) {
        editor.mark()
        g.marked = true
      }
      editor.eraseShape(hit.id)
    },
    [editor, hitShape],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const screen = getScreen(e)
      if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, screen)
      const g = gesture.current

      if (g.mode === 'pinch') {
        const pts = [...pointers.current.values()]
        if (pts.length < 2 || !pinchBase.current) return
        const newDist = dist(pts[0], pts[1])
        const newMid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
        const base = pinchBase.current
        if (base.dist > 0) editor.zoomBy(newDist / base.dist, newMid)
        editor.panBy(newMid.x - base.mid.x, newMid.y - base.mid.y)
        pinchBase.current = { dist: newDist, mid: newMid }
        return
      }

      if (g.mode === 'pan') {
        editor.panBy(screen.x - g.lastX, screen.y - g.lastY)
        g.lastX = screen.x
        g.lastY = screen.y
        return
      }

      const world = editor.screenToWorld(screen)

      if (g.mode === 'draw') {
        g.points.push({ x: world.x, y: world.y, p: e.pressure || 0.5 })
        updatePreview(g.points)
        return
      }

      if (g.mode === 'erase') {
        eraseAt(world)
        return
      }

      if (g.mode === 'move') {
        if (!g.marked) {
          editor.mark()
          g.marked = true
        }
        editor.updateShape(
          g.id,
          { x: g.startX + (world.x - g.grabWorld.x), y: g.startY + (world.y - g.grabWorld.y) },
          true,
        )
        return
      }

      if (g.mode === 'handle') {
        const shape = editor.getShape(g.id)
        const def = shape && getShapeDef(shape.type)
        if (!shape || !def?.onHandleDrag) return
        if (!g.marked) {
          editor.mark()
          g.marked = true
        }
        const local = { x: world.x - shape.x, y: world.y - shape.y }
        editor.updateShape(g.id, def.onHandleDrag(shape, g.handleId, local), true)
        return
      }
    },
    [editor, getScreen, eraseAt, updatePreview],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const el = containerRef.current
      if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      pointers.current.delete(e.pointerId)
      const g = gesture.current

      if (g.mode === 'draw') {
        commitStroke(g.points)
        updatePreview([])
      }

      if (pointers.current.size < 2) pinchBase.current = null
      gesture.current = { mode: 'idle' }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, updatePreview],
  )

  const commitStroke = useCallback(
    (points: StrokePoint[]) => {
      if (points.length === 0) return
      let minX = Infinity
      let minY = Infinity
      for (const p of points) {
        minX = Math.min(minX, p.x)
        minY = Math.min(minY, p.y)
      }
      const local = points.map((p) => ({ x: p.x - minX, y: p.y - minY, p: p.p }))
      const shape: DrawShape = {
        id: createShapeId('draw'),
        type: 'draw',
        x: minX,
        y: minY,
        points: local,
        size: DRAW_SIZE,
      }
      editor.createShape(shape)
    },
    [editor],
  )

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = containerRef.current!.getBoundingClientRect()
      const world = editor.screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top })
      const list = editor.getShapes()
      for (let i = list.length - 1; i >= 0; i--) {
        const s = list[i]
        const def = getShapeDef(s.type)
        if (def.hitTest(s, { x: world.x - s.x, y: world.y - s.y })) {
          if (def.canEdit) {
            editor.setCurrentTool('select')
            editor.mark()
            editor.setEditingShape(s.id)
          }
          return
        }
      }
    },
    [editor],
  )

  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      const rect = containerRef.current!.getBoundingClientRect()
      const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      if (e.ctrlKey || e.metaKey) {
        editor.zoomBy(Math.exp(-e.deltaY * 0.01), anchor)
      } else {
        editor.panBy(e.deltaX, e.deltaY)
      }
    },
    [editor],
  )

  // Wheel must be a non-passive native listener to allow preventDefault.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onWheel])

  const cam = camera
  const selected = selectedId ? editor.getShape(selectedId) : null
  const selectedDef = selected ? getShapeDef(selected.type) : null
  const selBounds = selected && selectedDef ? selectedDef.getBounds(selected) : null

  return (
    <div
      ref={containerRef}
      className="bp-canvas"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
      style={{ cursor: tool === 'draw' ? 'crosshair' : 'default' }}
    >
      <div
        className="bp-shapes-layer"
        style={{
          transform: `scale(${cam.z}) translate(${cam.x}px, ${cam.y}px)`,
          transformOrigin: '0 0',
        }}
      >
        {shapes.map((s) => (
          <ShapeView key={s.id} shape={s} editor={editor} editing={editingId === s.id} />
        ))}

        {/* Selection outline + handles for the selected shape. */}
        {selected && selBounds && (
          <svg
            className="bp-overlay"
            style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}
            width={1}
            height={1}
          >
            <rect
              x={selected.x + selBounds.x}
              y={selected.y + selBounds.y}
              width={selBounds.w}
              height={selBounds.h}
              fill="none"
              stroke={INK_COLOR}
              strokeWidth={1.5 / cam.z}
              strokeDasharray={`${4 / cam.z} ${3 / cam.z}`}
              opacity={0.9}
            />
            {selectedDef?.getHandles?.(selected).map((h) => (
              <circle
                key={h.id}
                cx={selected.x + h.x}
                cy={selected.y + h.y}
                r={5 / cam.z}
                fill="var(--blue-bottom)"
                stroke={INK_COLOR}
                strokeWidth={1.5 / cam.z}
              />
            ))}
          </svg>
        )}

        {/* Live freehand preview during a stroke. */}
        <svg
          className="bp-draw-preview"
          style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}
          width={1}
          height={1}
        >
          <path ref={drawPreviewRef} d="" fill={INK_COLOR} />
        </svg>
      </div>
    </div>
  )
}
