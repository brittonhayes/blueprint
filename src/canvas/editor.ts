import type {
  Camera,
  EditorSnapshot,
  Shape,
  ToolId,
  Vec,
} from './types'
import { screenToWorld, worldToScreen } from './geometry'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 8

let idCounter = 0
/** Short, collision-resistant id for a new shape. */
export function createShapeId(prefix = 'shape'): string {
  idCounter += 1
  return `${prefix}:${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`
}

function cloneShapes(shapes: Shape[]): Shape[] {
  // Shapes are plain JSON-serialisable objects; a structured clone keeps
  // history entries fully detached from the live document.
  return shapes.map((s) => structuredClone(s))
}

interface Persisted {
  shapes: Shape[]
  camera: Camera
}

/**
 * The blueprint canvas editor.
 *
 * A framework-agnostic document store: a flat list of shapes, a camera, the
 * active tool, and selection/edit state, plus undo history and localStorage
 * persistence. React subscribes through {@link subscribe}; the small
 * {@link useEditor}/{@link useValue} hooks in ./react mirror the slice of the
 * tldraw API the UI was written against, so the chrome barely changed.
 */
export class BlueprintEditor {
  private shapes: Shape[] = []
  private camera: Camera = { x: 0, y: 0, z: 1 }
  private tool: ToolId = 'draw'
  private selectedId: string | null = null
  private editingId: string | null = null

  private undoStack: Shape[][] = []
  private redoStack: Shape[][] = []

  private listeners = new Set<() => void>()
  private snapshot: EditorSnapshot = this.computeSnapshot()

  private viewport = { w: 1, h: 1 }
  private persistenceKey: string | null = null
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  // ── Subscription ──────────────────────────────────────────────────────
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getSnapshot = (): EditorSnapshot => this.snapshot

  private computeSnapshot(): EditorSnapshot {
    return {
      shapes: this.shapes,
      camera: this.camera,
      tool: this.tool,
      selectedId: this.selectedId,
      editingId: this.editingId,
    }
  }

  private emit(persist = true) {
    this.snapshot = this.computeSnapshot()
    for (const fn of this.listeners) fn()
    if (persist) this.scheduleSave()
  }

  // ── Persistence ───────────────────────────────────────────────────────
  loadPersistence(key: string) {
    this.persistenceKey = key
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const data = JSON.parse(raw) as Persisted
        if (Array.isArray(data.shapes)) this.shapes = data.shapes
        if (data.camera) this.camera = data.camera
      }
    } catch {
      // Corrupt payload — start from a clean plate.
    }
    this.emit(false)
  }

  private scheduleSave() {
    if (!this.persistenceKey) return
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.flush(), 400)
  }

  /** Write the current plate to storage immediately (e.g. on page hide). */
  flush() {
    if (!this.persistenceKey) return
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    const data: Persisted = { shapes: this.shapes, camera: this.camera }
    try {
      localStorage.setItem(this.persistenceKey, JSON.stringify(data))
    } catch {
      // Storage full or blocked — nothing we can do but keep drawing.
    }
  }

  // ── Tools ─────────────────────────────────────────────────────────────
  getCurrentToolId = (): ToolId => this.tool

  setCurrentTool(tool: ToolId) {
    this.tool = tool
    // Leaving a text tool while editing commits the edit.
    if (tool !== 'select') {
      this.editingId = null
      this.selectedId = null
    }
    this.emit(false)
  }

  // ── Shapes ────────────────────────────────────────────────────────────
  getShapes = (): Shape[] => this.shapes
  getShape = (id: string): Shape | undefined =>
    this.shapes.find((s) => s.id === id)
  isEmpty = (): boolean => this.shapes.length === 0

  /** Snapshot the current shapes onto the undo stack (call before a change). */
  mark() {
    this.undoStack.push(cloneShapes(this.shapes))
    if (this.undoStack.length > 200) this.undoStack.shift()
    this.redoStack = []
  }

  createShape(shape: Shape, { mark = true } = {}) {
    if (mark) this.mark()
    this.shapes = [...this.shapes, shape]
    this.emit()
  }

  /**
   * Patch a shape's props. Pass `ephemeral` during a drag/type gesture so the
   * intermediate frames don't each become an undo step (the caller marks once
   * at the start of the gesture instead).
   */
  updateShape(id: string, patch: Partial<Shape>, ephemeral = false) {
    if (!ephemeral) this.mark()
    this.shapes = this.shapes.map((s) =>
      s.id === id ? ({ ...s, ...patch } as Shape) : s,
    )
    this.emit()
  }

  deleteShapes(ids: string[]) {
    if (ids.length === 0) return
    this.mark()
    const set = new Set(ids)
    this.shapes = this.shapes.filter((s) => !set.has(s.id))
    if (this.selectedId && set.has(this.selectedId)) this.selectedId = null
    if (this.editingId && set.has(this.editingId)) this.editingId = null
    this.emit()
  }

  clearPage() {
    if (this.shapes.length === 0) return
    this.mark()
    this.shapes = []
    this.selectedId = null
    this.editingId = null
    this.emit()
  }

  /** Remove a single shape without touching history (for erase gestures). */
  eraseShape(id: string) {
    if (!this.shapes.some((s) => s.id === id)) return
    this.shapes = this.shapes.filter((s) => s.id !== id)
    if (this.selectedId === id) this.selectedId = null
    if (this.editingId === id) this.editingId = null
    this.emit()
  }

  /** Move a shape to the top of the z-order. */
  bringToFront(id: string) {
    const shape = this.getShape(id)
    if (!shape) return
    this.shapes = [...this.shapes.filter((s) => s.id !== id), shape]
    this.emit()
  }

  // ── Selection / editing ───────────────────────────────────────────────
  getSelectedId = (): string | null => this.selectedId
  getEditingShapeId = (): string | null => this.editingId

  select(id: string | null) {
    this.selectedId = id
    if (id === null) this.editingId = null
    this.emit(false)
  }

  setEditingShape(id: string | null) {
    const prev = this.editingId
    this.editingId = id
    if (id) this.selectedId = id
    // An abandoned, still-empty text label is noise — drop it on commit.
    if (prev && prev !== id) {
      const s = this.getShape(prev)
      if (s && s.type === 'text' && !s.text.trim()) {
        this.shapes = this.shapes.filter((x) => x.id !== prev)
        if (this.selectedId === prev) this.selectedId = null
      }
    }
    this.emit()
  }

  // ── History ───────────────────────────────────────────────────────────
  undo() {
    const prev = this.undoStack.pop()
    if (!prev) return
    this.redoStack.push(cloneShapes(this.shapes))
    this.shapes = prev
    this.selectedId = null
    this.editingId = null
    this.emit()
  }

  redo() {
    const next = this.redoStack.pop()
    if (!next) return
    this.undoStack.push(cloneShapes(this.shapes))
    this.shapes = next
    this.selectedId = null
    this.editingId = null
    this.emit()
  }

  // ── Camera / viewport ─────────────────────────────────────────────────
  getCamera = (): Camera => this.camera

  setViewport(w: number, h: number) {
    this.viewport = { w, h }
  }
  getViewport() {
    return this.viewport
  }

  setCamera(cam: Camera) {
    this.camera = {
      x: cam.x,
      y: cam.y,
      z: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.z)),
    }
    this.emit()
  }

  panBy(dxScreen: number, dyScreen: number) {
    this.setCamera({
      ...this.camera,
      x: this.camera.x - dxScreen / this.camera.z,
      y: this.camera.y - dyScreen / this.camera.z,
    })
  }

  /** Zoom toward a screen-space anchor point (e.g. the cursor). */
  zoomBy(factor: number, anchor: Vec) {
    const cam = this.camera
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.z * factor))
    // Keep the world point under the anchor fixed on screen.
    const world = screenToWorld(anchor, cam)
    this.setCamera({
      z,
      x: anchor.x / z - world.x,
      y: anchor.y / z - world.y,
    })
  }

  screenToWorld = (p: Vec): Vec => screenToWorld(p, this.camera)
  worldToScreen = (p: Vec): Vec => worldToScreen(p, this.camera)

  /** World coordinate at the centre of the current viewport. */
  getViewportCenter = (): Vec =>
    this.screenToWorld({ x: this.viewport.w / 2, y: this.viewport.h / 2 })
}
