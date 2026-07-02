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
  private selectedIds: string[] = []
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
      selectedIds: this.selectedIds,
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

  /** Nominal sharpie nib diameter in world px (fine / standard / broad). */
  private strokeSize = 5
  getStrokeSize = (): number => this.strokeSize
  setStrokeSize(size: number) {
    this.strokeSize = size
    this.emit(false)
  }

  setCurrentTool(tool: ToolId) {
    this.tool = tool
    // Leaving a text tool while editing commits the edit.
    if (tool !== 'select') {
      this.editingId = null
      this.selectedIds = []
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

  /**
   * Patch several shapes in one pass — the group move/rotate/scale gestures use
   * this so a single frame is one render and (when not ephemeral) one undo step.
   */
  updateShapes(
    patches: Array<{ id: string; patch: Partial<Shape> }>,
    ephemeral = false,
  ) {
    if (patches.length === 0) return
    if (!ephemeral) this.mark()
    const map = new Map(patches.map((p) => [p.id, p.patch]))
    this.shapes = this.shapes.map((s) => {
      const patch = map.get(s.id)
      return patch ? ({ ...s, ...patch } as Shape) : s
    })
    this.emit()
  }

  deleteShapes(ids: string[]) {
    if (ids.length === 0) return
    this.mark()
    const set = new Set(ids)
    this.shapes = this.shapes.filter((s) => !set.has(s.id))
    this.selectedIds = this.selectedIds.filter((id) => !set.has(id))
    if (this.editingId && set.has(this.editingId)) this.editingId = null
    this.emit()
  }

  clearPage() {
    if (this.shapes.length === 0) return
    this.mark()
    this.shapes = []
    this.selectedIds = []
    this.editingId = null
    this.emit()
  }

  /** Remove a single shape without touching history (for erase gestures). */
  eraseShape(id: string) {
    if (!this.shapes.some((s) => s.id === id)) return
    this.shapes = this.shapes.filter((s) => s.id !== id)
    this.selectedIds = this.selectedIds.filter((sid) => sid !== id)
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
  getSelectedIds = (): string[] => this.selectedIds
  /** The sole selected shape id, or null when zero or multiple are selected. */
  getSelectedId = (): string | null =>
    this.selectedIds.length === 1 ? this.selectedIds[0] : null
  getEditingShapeId = (): string | null => this.editingId

  /** Replace the selection with a single shape (or clear it). */
  select(id: string | null) {
    this.selectedIds = id ? [id] : []
    if (id === null) this.editingId = null
    this.emit(false)
  }

  /** Replace the selection with an explicit set of shape ids. */
  setSelectedIds(ids: string[]) {
    this.selectedIds = [...ids]
    if (ids.length !== 1 || ids[0] !== this.editingId) this.editingId = null
    this.emit(false)
  }

  /** Add or remove one shape from the current selection (shift-click). */
  toggleSelected(id: string) {
    this.selectedIds = this.selectedIds.includes(id)
      ? this.selectedIds.filter((s) => s !== id)
      : [...this.selectedIds, id]
    this.editingId = null
    this.emit(false)
  }

  /** Select every shape on the page. */
  selectAll() {
    this.selectedIds = this.shapes.map((s) => s.id)
    this.editingId = null
    this.emit(false)
  }

  setEditingShape(id: string | null) {
    const prev = this.editingId
    this.editingId = id
    if (id) this.selectedIds = [id]
    // An abandoned, still-empty text label is noise — drop it on commit.
    if (prev && prev !== id) {
      const s = this.getShape(prev)
      if (s && s.type === 'text' && !s.text.trim()) {
        this.shapes = this.shapes.filter((x) => x.id !== prev)
        this.selectedIds = this.selectedIds.filter((sid) => sid !== prev)
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
    this.selectedIds = []
    this.editingId = null
    this.emit()
  }

  redo() {
    const next = this.redoStack.pop()
    if (!next) return
    this.undoStack.push(cloneShapes(this.shapes))
    this.shapes = next
    this.selectedIds = []
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
