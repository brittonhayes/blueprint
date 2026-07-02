import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, useValue } from './react'
import { getShapeDef } from '../shapes'
import { createShapeId } from './editor'
import { dist } from './geometry'
import type { DrawShape, Shape, StrokePoint, Vec } from './types'
import { ShapeView } from './ShapeView'
import { getStrokePath, TAPER_RATIO } from './freehand'
import { INK_COLOR, INK_COLOR_SEMI } from './blueprintTheme'
import {
  aabbToFrame,
  boundsIntersect,
  clampScale,
  getFrameCorners,
  getFrameRotateGrip,
  getFrameScaleGrip,
  getGroupWorldAABB,
  getLocalCenter,
  getRotateHandleWorld,
  getRotation,
  getScale,
  getScaleHandleWorld,
  getWorldAABB,
  getWorldCenter,
  getWorldCorners,
  rotateAround,
  shapeLocalToWorld,
  worldToShapeLocal,
} from './transform'
import type { GroupFrame } from './transform'

/** A per-shape start state captured when a group rotate/scale gesture begins. */
interface TransformStart {
  id: string
  rotation: number
  scale: number
  /** World-space centre of the shape at gesture start (the orbit anchor). */
  wc: Vec
  /** Local-bounds centre (constant across the gesture). */
  lc: Vec
}

/** Normalised world rectangle spanning two corner points. */
function rectBetween(a: Vec, b: Vec) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  }
}

/** Capture each shape's start transform so a group gesture applies an absolute delta. */
function makeTransformStarts(shapes: Shape[]): TransformStart[] {
  return shapes.map((s) => ({
    id: s.id,
    rotation: getRotation(s),
    scale: getScale(s),
    wc: getWorldCenter(s),
    lc: getLocalCenter(s),
  }))
}

const HANDLE_HIT = 12
/** Screen-px gap between a shape's top edge and its rotate grip. */
const ROTATE_OFFSET = 26
/** Shift-rotate snaps to multiples of 15°. */
const ROTATE_SNAP = Math.PI / 12
/** 45° spacing of the free-rotation detents. */
const ROTATE_DETENT_STEP = Math.PI / 4
/**
 * Pointer travel a detent swallows once you cross a 45° mark. The rotation holds
 * still across this much extra mouse movement — a brief deadzone that reads as a
 * tactile catch — then releases and tracks the pointer again, no value pinning.
 */
const ROTATE_DETENT_HOLD = Math.PI / 60 // 3°

/**
 * Mutable per-gesture state for the soft rotation detent. `raw` is the last raw
 * pointer delta we saw, `emit` the eased delta we last returned, and `hold` the
 * signed pointer travel still to be swallowed by the current catch.
 */
interface DetentState {
  raw: number
  emit: number
  hold: number
}

/**
 * Advance the detent by one pointer sample and return the eased rotation delta.
 *
 * The pointer is tracked 1:1 — no magnetic pull toward 45° from a distance — but
 * the instant the eased angle reaches a detent (a multiple of 45° once `base`,
 * the shape's start rotation, is added back) it stops there and opens a small
 * deadzone: the next `ROTATE_DETENT_HOLD` of travel in the same direction moves
 * nothing, so you feel a catch exactly at the mark. Push past the deadzone and
 * rotation resumes; reverse and the catch releases immediately, so backing out
 * is free. Every angle stays reachable — a mark just costs a little extra travel.
 */
function stepDetent(s: DetentState, rawD: number, base: number): number {
  const step = ROTATE_DETENT_STEP
  let remaining = rawD - s.raw
  s.raw = rawD
  // Feed motion into an open catch first; reversing direction cancels it.
  if (s.hold !== 0) {
    if (Math.sign(remaining) === Math.sign(s.hold)) {
      const absorb = Math.min(Math.abs(remaining), Math.abs(s.hold)) * Math.sign(s.hold)
      s.hold -= absorb
      remaining -= absorb
    } else if (remaining !== 0) {
      s.hold = 0
    }
  }
  if (remaining === 0) return s.emit
  const dir = Math.sign(remaining)
  const target = s.emit + remaining
  const from = s.emit + base
  const to = target + base
  // Nearest detent strictly ahead of the current angle in the travel direction.
  const nextDetent =
    dir > 0
      ? Math.ceil((from + 1e-9) / step) * step
      : Math.floor((from - 1e-9) / step) * step
  if ((dir > 0 && to >= nextDetent) || (dir < 0 && to <= nextDetent)) {
    // Reached a mark: stop on it and open the deadzone. Travel already past the
    // mark this frame is spent against the deadzone; any surplus rotates on.
    const overshoot = Math.abs(to - nextDetent)
    if (overshoot >= ROTATE_DETENT_HOLD) {
      s.emit = nextDetent - base + (overshoot - ROTATE_DETENT_HOLD) * dir
      s.hold = 0
    } else {
      s.emit = nextDetent - base
      s.hold = (ROTATE_DETENT_HOLD - overshoot) * dir
    }
  } else {
    s.emit = target
  }
  return s.emit
}

/**
 * Marker pressure for devices that don't report it: slow, deliberate movement
 * presses the nib wide; a fast flick rides light and thin. `speed` is in
 * screen px/s; the result is blended toward the previous sample so the width
 * never steps visibly.
 */
function simulatePressure(prevP: number, speed: number): number {
  const target = 0.85 - 0.55 * Math.min(1, speed / 1600)
  return prevP + (target - prevP) * 0.35
}

/** A round nib cursor matching the on-screen stroke width. */
function nibCursor(diameter: number): string {
  const d = Math.max(4, Math.min(40, Math.round(diameter)))
  const r = d / 2
  const s = d + 4
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'>` +
    `<circle cx='${s / 2}' cy='${s / 2}' r='${r}' fill='rgba(198,204,209,0.35)' ` +
    `stroke='%23c6ccd1' stroke-width='1.2'/></svg>`
  return `url("data:image/svg+xml,${svg}") ${s / 2} ${s / 2}, crosshair`
}

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
  | { mode: 'draw'; points: StrokePoint[]; size: number; lastT: number; lastScreen: Vec }
  | { mode: 'pan'; lastX: number; lastY: number }
  | { mode: 'marquee'; start: Vec; base: string[] }
  | { mode: 'move'; starts: { id: string; x: number; y: number }[]; grabWorld: Vec; frameStart: GroupFrame | null; marked: boolean }
  | { mode: 'handle'; id: string; handleId: string; marked: boolean }
  | { mode: 'rotate'; center: Vec; startAng: number; starts: TransformStart[]; frameStart: GroupFrame | null; detent: DetentState; marked: boolean }
  | { mode: 'scale'; center: Vec; startDist: number; starts: TransformStart[]; frameStart: GroupFrame | null; marked: boolean }
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
  const marqueeRef = useRef<SVGRectElement>(null)

  const shapes = useValue('shapes', () => editor.getShapes(), [editor])
  const camera = useValue('camera', () => editor.getCamera(), [editor])
  const tool = useValue('tool', () => editor.getCurrentToolId(), [editor])
  const strokeSize = useValue('stroke-size', () => editor.getStrokeSize(), [editor])
  const selectedIds = useValue('selected', () => editor.getSelectedIds(), [editor])
  const editingId = useValue('editing', () => editor.getEditingShapeId(), [editor])

  // The oriented frame drawn around a multi-selection. It lives here (not in the
  // document) because it's transient chrome: the ref is what gesture handlers
  // read/write mid-drag; the state mirror re-renders the overlay.
  const [groupFrame, setGroupFrame] = useState<GroupFrame | null>(null)
  const groupFrameRef = useRef<GroupFrame | null>(null)
  const setFrame = useCallback((f: GroupFrame | null) => {
    groupFrameRef.current = f
    setGroupFrame(f)
  }, [])

  // Reset the frame to a fresh axis-aligned box whenever the *membership* of the
  // selection changes. Gesture updates (which keep the same members) are left
  // alone, so an in-progress rotation isn't snapped back upright.
  const selectionKey = selectedIds.length > 1 ? selectedIds.join('|') : ''
  useEffect(() => {
    if (!selectionKey) {
      setFrame(null)
      return
    }
    const shapes = editor
      .getSelectedIds()
      .map((id) => editor.getShape(id))
      .filter((s): s is Shape => !!s)
    setFrame(aabbToFrame(getGroupWorldAABB(shapes)))
  }, [selectionKey, editor, setFrame])

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
      if (mod && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        editor.setCurrentTool('select')
        editor.selectAll()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const ids = editor.getSelectedIds()
        if (ids.length > 0 && !editor.getEditingShapeId()) {
          e.preventDefault()
          editor.deleteShapes(ids)
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
        if (def.hitTest(s, worldToShapeLocal(s, world))) return s
      }
      return null
    },
    [editor],
  )

  const updatePreview = useCallback((points: StrokePoint[], size: number) => {
    if (drawPreviewRef.current) {
      drawPreviewRef.current.setAttribute(
        'd',
        getStrokePath(points, { size, taper: size * TAPER_RATIO }),
      )
    }
  }, [])

  /** Live-position the rubber-band selection rectangle (world coords), or hide it. */
  const updateMarquee = useCallback(
    (rect: { x: number; y: number; w: number; h: number } | null) => {
      const el = marqueeRef.current
      if (!el) return
      if (!rect) {
        el.setAttribute('visibility', 'hidden')
        return
      }
      const z = editor.getCamera().z
      el.setAttribute('x', String(rect.x))
      el.setAttribute('y', String(rect.y))
      el.setAttribute('width', String(rect.w))
      el.setAttribute('height', String(rect.h))
      el.setAttribute('stroke-width', String(1.5 / z))
      el.setAttribute('stroke-dasharray', `${5 / z} ${4 / z}`)
      el.setAttribute('visibility', 'visible')
    },
    [editor],
  )

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
        updatePreview([], 1)
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
        const isPen = e.pointerType === 'pen'
        const pt: StrokePoint = { x: world.x, y: world.y, p: isPen ? e.pressure || 0.5 : 0.7 }
        const size = editor.getStrokeSize()
        gesture.current = {
          mode: 'draw',
          points: [pt],
          size,
          lastT: e.timeStamp,
          lastScreen: screen,
        }
        updatePreview([pt], size)
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
      const z = editor.getCamera().z
      const selIds = editor.getSelectedIds()
      const selShapes = selIds
        .map((id) => editor.getShape(id))
        .filter((s): s is Shape => !!s)

      // Universal transform grips first: rotate above, scale at the corner. A
      // single selection uses the shape's own (possibly rotated) bounds; a
      // multi-selection uses its oriented group frame so the grips travel with
      // the box as it turns.
      if (selShapes.length > 0) {
        const frame =
          selShapes.length > 1
            ? groupFrameRef.current ?? aabbToFrame(getGroupWorldAABB(selShapes))
            : null
        const center = frame
          ? { x: frame.cx, y: frame.cy }
          : getWorldCenter(selShapes[0])
        const rotGripWorld = frame
          ? getFrameRotateGrip(frame, ROTATE_OFFSET / z)
          : getRotateHandleWorld(selShapes[0], ROTATE_OFFSET / z)
        const scaleGripWorld = frame
          ? getFrameScaleGrip(frame)
          : getScaleHandleWorld(selShapes[0])

        if (dist(editor.worldToScreen(rotGripWorld), screen) <= HANDLE_HIT) {
          gesture.current = {
            mode: 'rotate',
            center,
            startAng: Math.atan2(world.y - center.y, world.x - center.x),
            starts: makeTransformStarts(selShapes),
            frameStart: frame,
            detent: { raw: 0, emit: 0, hold: 0 },
            marked: false,
          }
          return
        }
        if (dist(editor.worldToScreen(scaleGripWorld), screen) <= HANDLE_HIT) {
          gesture.current = {
            mode: 'scale',
            center,
            startDist: Math.max(1e-3, dist(world, center)),
            starts: makeTransformStarts(selShapes),
            frameStart: frame,
            marked: false,
          }
          return
        }

        // Shape-specific handles only exist for a lone selection.
        if (selShapes.length === 1) {
          const sel = selShapes[0]
          const def = getShapeDef(sel.type)
          if (def.getHandles) {
            for (const h of def.getHandles(sel)) {
              const hs = editor.worldToScreen(shapeLocalToWorld(sel, h))
              if (dist(hs, screen) <= HANDLE_HIT) {
                gesture.current = { mode: 'handle', id: sel.id, handleId: h.id, marked: false }
                return
              }
            }
          }
        }
      }

      const hit = hitShape(world)
      const additive = e.shiftKey

      if (hit) {
        if (additive) {
          // Toggle this shape in/out of the selection; no drag on a shift-click.
          editor.toggleSelected(hit.id)
          gesture.current = { mode: 'idle' }
          return
        }
        // Grabbing a shape already in a multi-selection drags the whole set;
        // grabbing an unselected shape collapses the selection onto it.
        const alreadySelected = selIds.includes(hit.id)
        if (!alreadySelected) editor.select(hit.id)
        const moveIds = alreadySelected ? selIds : [hit.id]
        gesture.current = {
          mode: 'move',
          grabWorld: world,
          starts: moveIds.map((id) => {
            const s = editor.getShape(id)!
            return { id, x: s.x, y: s.y }
          }),
          frameStart: alreadySelected ? groupFrameRef.current : null,
          marked: false,
        }
      } else {
        // Empty space → rubber-band marquee. Shift keeps the current selection
        // as a base to add to; a plain click clears it.
        const base = additive ? selIds : []
        if (!additive) editor.select(null)
        gesture.current = { mode: 'marquee', start: world, base }
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
        // Consume every coalesced sample the browser batched into this event —
        // this is where the "drawing at display rate" feel comes from.
        const native = e.nativeEvent
        const samples: PointerEvent[] = native.getCoalescedEvents?.() ?? []
        if (samples.length === 0) samples.push(native)
        const rect = containerRef.current!.getBoundingClientRect()
        const isPen = e.pointerType === 'pen'
        for (const ev of samples) {
          const s = { x: ev.clientX - rect.left, y: ev.clientY - rect.top }
          const w = editor.screenToWorld(s)
          let p: number
          if (isPen) {
            p = ev.pressure || 0.5
          } else {
            const dt = Math.max(1, ev.timeStamp - g.lastT)
            const speed = (dist(s, g.lastScreen) / dt) * 1000
            p = simulatePressure(g.points[g.points.length - 1].p, speed)
          }
          g.points.push({ x: w.x, y: w.y, p })
          g.lastT = ev.timeStamp
          g.lastScreen = s
        }
        updatePreview(g.points, g.size)
        return
      }

      if (g.mode === 'erase') {
        eraseAt(world)
        return
      }

      if (g.mode === 'marquee') {
        const rect = rectBetween(g.start, world)
        updateMarquee(rect)
        const base = new Set(g.base)
        for (const s of editor.getShapes()) {
          if (boundsIntersect(getWorldAABB(s), rect)) base.add(s.id)
        }
        editor.setSelectedIds([...base])
        return
      }

      if (g.mode === 'move') {
        if (!g.marked) {
          editor.mark()
          g.marked = true
        }
        const dx = world.x - g.grabWorld.x
        const dy = world.y - g.grabWorld.y
        editor.updateShapes(
          g.starts.map((s) => ({ id: s.id, patch: { x: s.x + dx, y: s.y + dy } })),
          true,
        )
        if (g.frameStart) {
          setFrame({ ...g.frameStart, cx: g.frameStart.cx + dx, cy: g.frameStart.cy + dy })
        }
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
        const local = worldToShapeLocal(shape, world)
        editor.updateShape(g.id, def.onHandleDrag(shape, g.handleId, local), true)
        return
      }

      if (g.mode === 'rotate') {
        if (!g.marked) {
          editor.mark()
          g.marked = true
        }
        const ang = Math.atan2(world.y - g.center.y, world.x - g.center.x)
        const rawD = ang - g.startAng
        // Detents ride on the absolute angle for a lone shape (so it lands on
        // world 45°s and reads as aligned with its neighbours) and on the raw
        // delta for a group (which spins rigidly about the pivot).
        const base = g.starts.length === 1 ? g.starts[0].rotation : 0
        let d: number
        if (e.shiftKey) {
          // Shift: hard snap to 15°.
          d = Math.round((rawD + base) / ROTATE_SNAP) * ROTATE_SNAP - base
          // Keep the detent coherent so releasing shift resumes without a jump.
          g.detent.raw = rawD
          g.detent.emit = d
          g.detent.hold = 0
        } else {
          // Free rotation: track the pointer, but catch briefly on each 45°.
          d = stepDetent(g.detent, rawD, base)
        }
        // Each shape spins about its own centre and orbits the pivot by the
        // same angle, so a group rotates rigidly.
        editor.updateShapes(
          g.starts.map((s) => {
            const nc = rotateAround(s.wc, g.center, d)
            return {
              id: s.id,
              patch: {
                rotation: s.rotation + d,
                x: nc.x - s.lc.x,
                y: nc.y - s.lc.y,
              },
            }
          }),
          true,
        )
        if (g.frameStart) {
          setFrame({ ...g.frameStart, rotation: g.frameStart.rotation + d })
        }
        return
      }

      if (g.mode === 'scale') {
        if (!g.marked) {
          editor.mark()
          g.marked = true
        }
        const factor = dist(world, g.center) / g.startDist
        editor.updateShapes(
          g.starts.map((s) => ({
            id: s.id,
            patch: {
              scale: clampScale(s.scale * factor),
              x: g.center.x + (s.wc.x - g.center.x) * factor - s.lc.x,
              y: g.center.y + (s.wc.y - g.center.y) * factor - s.lc.y,
            },
          })),
          true,
        )
        if (g.frameStart) {
          setFrame({
            ...g.frameStart,
            hw: g.frameStart.hw * factor,
            hh: g.frameStart.hh * factor,
          })
        }
        return
      }
    },
    [editor, getScreen, eraseAt, updatePreview, updateMarquee, setFrame],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const el = containerRef.current
      if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      pointers.current.delete(e.pointerId)
      const g = gesture.current

      if (g.mode === 'draw') {
        commitStroke(g.points, g.size)
        updatePreview([], 1)
      }

      if (g.mode === 'marquee') updateMarquee(null)

      if (pointers.current.size < 2) pinchBase.current = null
      gesture.current = { mode: 'idle' }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, updatePreview, updateMarquee],
  )

  const commitStroke = useCallback(
    (points: StrokePoint[], size: number) => {
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
        size,
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
        if (def.hitTest(s, worldToShapeLocal(s, world))) {
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
  const selectedShapes = selectedIds
    .map((id) => editor.getShape(id))
    .filter((s): s is Shape => !!s)
  // A lone selection shows the shape's own rotated outline + type-specific
  // handles; a multi-selection shows the oriented group frame.
  const single = selectedShapes.length === 1 ? selectedShapes[0] : null
  const singleDef = single ? getShapeDef(single.type) : null
  const singleCorners = single ? getWorldCorners(single) : null
  const singleRotGrip = single ? getRotateHandleWorld(single, ROTATE_OFFSET / cam.z) : null
  const singleScaleGrip = single ? getScaleHandleWorld(single) : null
  const frame = selectedShapes.length > 1 ? groupFrame : null
  const frameCorners = frame ? getFrameCorners(frame) : null
  const frameRotGrip = frame ? getFrameRotateGrip(frame, ROTATE_OFFSET / cam.z) : null
  const frameScaleGrip = frame ? getFrameScaleGrip(frame) : null

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
      style={{
        cursor:
          tool === 'draw'
            ? nibCursor(strokeSize * cam.z)
            : tool === 'eraser'
              ? nibCursor(18)
              : 'default',
      }}
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

        {/* Single-shape selection: rotated outline, type handles, and grips. */}
        {single && singleCorners && singleRotGrip && singleScaleGrip && (
          <svg
            className="bp-overlay"
            style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}
            width={1}
            height={1}
          >
            <polygon
              points={singleCorners.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={INK_COLOR}
              strokeWidth={1.5 / cam.z}
              strokeDasharray={`${4 / cam.z} ${3 / cam.z}`}
              opacity={0.9}
            />
            {singleDef?.getHandles?.(single).map((h) => {
              const p = shapeLocalToWorld(single, h)
              return (
                <circle
                  key={h.id}
                  cx={p.x}
                  cy={p.y}
                  r={5 / cam.z}
                  fill="var(--blue-bottom)"
                  stroke={INK_COLOR}
                  strokeWidth={1.5 / cam.z}
                />
              )
            })}
            {/* Rotate grip: a stem off the top edge ending in a circle. */}
            <line
              x1={(singleCorners[0].x + singleCorners[1].x) / 2}
              y1={(singleCorners[0].y + singleCorners[1].y) / 2}
              x2={singleRotGrip.x}
              y2={singleRotGrip.y}
              stroke={INK_COLOR}
              strokeWidth={1.5 / cam.z}
              opacity={0.7}
            />
            <circle
              cx={singleRotGrip.x}
              cy={singleRotGrip.y}
              r={5.5 / cam.z}
              fill="var(--blue-bottom)"
              stroke={INK_COLOR}
              strokeWidth={1.5 / cam.z}
            />
            {/* Scale grip: a square on the bottom-right corner. */}
            <rect
              x={singleScaleGrip.x - 5 / cam.z}
              y={singleScaleGrip.y - 5 / cam.z}
              width={10 / cam.z}
              height={10 / cam.z}
              fill="var(--blue-bottom)"
              stroke={INK_COLOR}
              strokeWidth={1.5 / cam.z}
            />
          </svg>
        )}

        {/* Multi-selection: an oriented group frame that turns with its contents,
            with each member's own rotated outline shown faintly inside. */}
        {frame && frameCorners && frameRotGrip && frameScaleGrip && (
          <svg
            className="bp-overlay"
            style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}
            width={1}
            height={1}
          >
            {selectedShapes.map((s) => (
              <polygon
                key={s.id}
                points={getWorldCorners(s).map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={INK_COLOR}
                strokeWidth={1 / cam.z}
                opacity={0.35}
              />
            ))}
            <polygon
              points={frameCorners.map((p) => `${p.x},${p.y}`).join(' ')}
              fill={INK_COLOR_SEMI}
              stroke={INK_COLOR}
              strokeWidth={1.5 / cam.z}
              strokeDasharray={`${5 / cam.z} ${4 / cam.z}`}
              opacity={0.95}
            />
            {/* Rotate grip: a stem off the (rotated) top edge ending in a circle. */}
            <line
              x1={(frameCorners[0].x + frameCorners[1].x) / 2}
              y1={(frameCorners[0].y + frameCorners[1].y) / 2}
              x2={frameRotGrip.x}
              y2={frameRotGrip.y}
              stroke={INK_COLOR}
              strokeWidth={1.5 / cam.z}
              opacity={0.7}
            />
            <circle
              cx={frameRotGrip.x}
              cy={frameRotGrip.y}
              r={5.5 / cam.z}
              fill="var(--blue-bottom)"
              stroke={INK_COLOR}
              strokeWidth={1.5 / cam.z}
            />
            {/* Scale grip: a square on the (rotated) bottom-right corner. */}
            <rect
              x={frameScaleGrip.x - 5 / cam.z}
              y={frameScaleGrip.y - 5 / cam.z}
              width={10 / cam.z}
              height={10 / cam.z}
              fill="var(--blue-bottom)"
              stroke={INK_COLOR}
              strokeWidth={1.5 / cam.z}
              transform={`rotate(${(frame.rotation * 180) / Math.PI} ${frameScaleGrip.x} ${frameScaleGrip.y})`}
            />
          </svg>
        )}

        {/* Rubber-band marquee (positioned imperatively during a drag). */}
        <svg
          className="bp-marquee"
          style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}
          width={1}
          height={1}
        >
          <rect
            ref={marqueeRef}
            visibility="hidden"
            x={0}
            y={0}
            width={0}
            height={0}
            fill={INK_COLOR_SEMI}
            stroke={INK_COLOR}
            strokeWidth={1.5 / cam.z}
            strokeDasharray={`${5 / cam.z} ${4 / cam.z}`}
          />
        </svg>

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
