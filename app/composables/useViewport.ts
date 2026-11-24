import {
  adaptiveGridStep,
  clientToWorld as projectClientToWorld,
  fitViewBox,
  formatGridStep,
  panViewBox,
  pinchViewBox,
  pixelsPerMm,
  resizeViewBox,
  zoomViewBoxAt,
  zoomViewBoxCenter,
  zoomViewBoxToBounds,
  zoomViewBoxToPoint,
  type Bounds,
  type ClientRectLike,
  type EditorTool,
  type Point,
  type ViewBox,
} from '../../shared/cad'

export type ViewportTool = EditorTool

export interface UseViewportOptions {
  getFitBounds: () => Bounds
  getSelectionBounds?: () => Bounds | null
  onCancelSingleTouch?: () => void
  onPointerActivity?: (event: { world: Point, inside: boolean }) => void
  viewBoxRef?: Ref<ViewBox>
  showGridRef?: Ref<boolean>
  pxPerMmRef?: Ref<number>
  toolRef?: Ref<ViewportTool>
  /** Nonaktifkan pintasan keyboard internal saat halaman memakai tabel pintasan tunggal. */
  handleShortcuts?: boolean
}

interface PinchState {
  mid: Point
  dist: number
}

interface PanDragState {
  pointerId: number
  startX: number
  startY: number
  startVb: ViewBox
}

export function useViewport(options: UseViewportOptions) {
  const svgEl = ref<SVGSVGElement | null>(null)
  const viewBox = options.viewBoxRef ?? ref<ViewBox>(fitViewBox(options.getFitBounds()))
  const fitPx = ref(1)
  const pxPerMm = options.pxPerMmRef ?? ref(1)
  const showGrid = options.showGridRef ?? ref(true)
  const tool = options.toolRef ?? ref<ViewportTool>('select')
  const spaceDown = ref(false)
  const isPanning = ref(false)
  const isPinching = ref(false)
  const cursorWorld = ref<Point>([0, 0])
  const cursorInside = ref(false)

  let lastRect: ClientRectLike | null = null
  let animFrame = 0
  let panDrag: PanDragState | null = null
  let singleTouchPointerId: number | null = null
  const activeTouches = new Map<number, Point>()
  let pinchState: PinchState | null = null

  const gridStep = computed(() => adaptiveGridStep(pxPerMm.value))
  const gridStepLabel = computed(() => formatGridStep(gridStep.value))
  const zoomPercent = computed(() => Math.max(1, Math.round((pxPerMm.value / (fitPx.value || 1)) * 100)))
  const isPanMode = computed(() => tool.value === 'pan' || spaceDown.value || isPanning.value)
  const coordLabel = computed(() => `X ${Math.round(cursorWorld.value[0])}  Y ${Math.round(-cursorWorld.value[1])}`)

  function readRect(): ClientRectLike | null {
    const svg = svgEl.value
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    if (!(rect.width > 0) || !(rect.height > 0)) return null
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
  }

  function measureMetrics(vb: ViewBox) {
    const rect = readRect()
    if (rect) {
      pxPerMm.value = pixelsPerMm(vb, rect.width, rect.height)
      lastRect = rect
    }
  }

  function clientToWorld(clientX: number, clientY: number, vb: ViewBox = viewBox.value): Point {
    const rect = readRect()
    if (!rect) return [0, 0]
    return projectClientToWorld(vb, rect, clientX, clientY)
  }

  function stopAnim() {
    if (animFrame && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(animFrame)
      animFrame = 0
    }
  }

  function setViewBox(next: ViewBox) {
    viewBox.value = next
    measureMetrics(next)
  }

  function animateViewBox(target: ViewBox, durationMs = 280) {
    stopAnim()
    const prefersReduced = import.meta.client && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced || typeof requestAnimationFrame !== 'function' || durationMs <= 0) {
      setViewBox(target)
      return
    }
    const start: ViewBox = [...viewBox.value]
    const t0 = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - t0) / durationMs)
      const eased = 1 - (1 - progress) ** 3
      setViewBox([
        start[0] + (target[0] - start[0]) * eased,
        start[1] + (target[1] - start[1]) * eased,
        start[2] + (target[2] - start[2]) * eased,
        start[3] + (target[3] - start[3]) * eased,
      ])
      if (progress < 1) {
        animFrame = requestAnimationFrame(tick)
      }
      else {
        animFrame = 0
      }
    }
    animFrame = requestAnimationFrame(tick)
  }

  function fit(immediate = false) {
    const target = fitViewBox(options.getFitBounds())
    const svg = svgEl.value
    if (svg) {
      const rect = svg.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        fitPx.value = pixelsPerMm(target, rect.width, rect.height)
      }
    }
    if (immediate) setViewBox(target)
    else animateViewBox(target)
  }

  function zoomToSelection() {
    const selBounds = options.getSelectionBounds?.()
    if (!selBounds) {
      fit()
      return
    }
    animateViewBox(zoomViewBoxToBounds(viewBox.value, selBounds))
  }

  function zoomToPoint(point: Point, maxWidth = 7000) {
    animateViewBox(zoomViewBoxToPoint(viewBox.value, point, maxWidth))
  }

  function zoomIn() {
    animateViewBox(zoomViewBoxCenter(viewBox.value, 1 / 1.25), 200)
  }

  function zoomOut() {
    animateViewBox(zoomViewBoxCenter(viewBox.value, 1.25), 200)
  }

  function toggleGrid() {
    showGrid.value = !showGrid.value
  }

  function setTool(next: ViewportTool) {
    tool.value = next
  }

  function touchMetrics(): PinchState {
    const pts = [...activeTouches.values()]
    const a = pts[0]!
    const b = pts[1]!
    return {
      mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      dist: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1,
    }
  }

  function cancelActivePan() {
    panDrag = null
    isPanning.value = false
  }

  // ---- Capture-phase handler untuk sentuh dua jari (ADR 0009) ----
  function onTouchPointerDownCapture(e: PointerEvent) {
    if (e.pointerType !== 'touch') return
    activeTouches.set(e.pointerId, [e.clientX, e.clientY])
    if (activeTouches.size === 1) {
      singleTouchPointerId = e.pointerId
      return
    }
    if (activeTouches.size !== 2) return
    e.stopImmediatePropagation()
    e.preventDefault()
    // Jari kedua membatalkan gerakan satu jari yang sedang berjalan
    if (panDrag || singleTouchPointerId !== null) {
      cancelActivePan()
      singleTouchPointerId = null
      options.onCancelSingleTouch?.()
    }
    stopAnim()
    cursorInside.value = false
    isPinching.value = true
    pinchState = touchMetrics()
  }

  function onTouchPointerMoveCapture(e: PointerEvent) {
    if (!activeTouches.has(e.pointerId)) return
    activeTouches.set(e.pointerId, [e.clientX, e.clientY])
    if (!pinchState || activeTouches.size !== 2) return
    e.stopImmediatePropagation()
    e.preventDefault()
    const rect = readRect()
    if (!rect) return
    const next = touchMetrics()
    setViewBox(pinchViewBox(viewBox.value, rect, pinchState.mid, next.mid, pinchState.dist, next.dist))
    pinchState = next
  }

  function onTouchPointerEndCapture(e: PointerEvent) {
    const removed = activeTouches.delete(e.pointerId)
    if (e.pointerId === singleTouchPointerId) {
      singleTouchPointerId = null
    }
    if (!removed || !pinchState) return
    e.stopImmediatePropagation()
    if (activeTouches.size < 2) {
      pinchState = null
      isPinching.value = false
    }
  }

  // ---- Bubble-phase handler untuk wheel, pan, dan kursor ----
  function onWheel(e: WheelEvent) {
    e.preventDefault()
    stopAnim()
    const anchor = clientToWorld(e.clientX, e.clientY)
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15
    setViewBox(zoomViewBoxAt(viewBox.value, anchor, factor))
  }

  function onPointerDown(e: PointerEvent) {
    const world = clientToWorld(e.clientX, e.clientY)
    cursorWorld.value = world
    if (e.pointerType !== 'touch') {
      cursorInside.value = true
      if (document.activeElement !== svgEl.value) {
        svgEl.value?.focus({ preventScroll: true })
      }
    }

    if (e.button === 1 || tool.value === 'pan' || spaceDown.value) {
      e.preventDefault()
      stopAnim()
      panDrag = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startVb: [...viewBox.value],
      }
      isPanning.value = true
      try {
        svgEl.value?.setPointerCapture(e.pointerId)
      }
      catch {
        // Synthetic pointer event di tes mungkin tidak memiliki pointer aktif.
      }
    }
  }

  function onPointerMove(e: PointerEvent) {
    const world = clientToWorld(e.clientX, e.clientY)
    cursorWorld.value = world
    if (e.pointerType !== 'touch') {
      cursorInside.value = true
    }
    options.onPointerActivity?.({ world, inside: cursorInside.value })

    if (panDrag && panDrag.pointerId === e.pointerId) {
      setViewBox(panViewBox(panDrag.startVb, e.clientX - panDrag.startX, e.clientY - panDrag.startY, pxPerMm.value))
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (panDrag && panDrag.pointerId === e.pointerId) {
      cancelActivePan()
    }
  }

  function onPointerLeave() {
    cursorInside.value = false
    options.onPointerActivity?.({ world: cursorWorld.value, inside: false })
  }

  function onKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null
    if (target?.closest('input, select, textarea, dialog')) return
    if (e.ctrlKey || e.metaKey || e.altKey) return

    const key = e.key.toLowerCase()
    if (e.key === ' ') {
      if (!target?.closest('button, a')) {
        e.preventDefault()
        spaceDown.value = true
      }
      return
    }
    if (options.handleShortcuts === false) return

    if (e.key === 'F7') {
      e.preventDefault()
      toggleGrid()
      return
    }
    if (key === 'z') {
      e.preventDefault()
      if (e.shiftKey) fit()
      else zoomToSelection()
      return
    }
    if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      zoomIn()
      return
    }
    if (e.key === '-') {
      e.preventDefault()
      zoomOut()
      return
    }
    if (key === 'h') {
      setTool('pan')
      return
    }
    if (key === 'v') {
      setTool('select')
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.key === ' ') {
      spaceDown.value = false
    }
  }

  function onWindowBlur() {
    spaceDown.value = false
    cancelActivePan()
    activeTouches.clear()
    pinchState = null
    isPinching.value = false
  }

  let resizeObserver: ResizeObserver | null = null
  let boundSvg: SVGSVGElement | null = null

  function unbindSvg() {
    if (boundSvg) {
      boundSvg.removeEventListener('pointerdown', onTouchPointerDownCapture, true)
      boundSvg.removeEventListener('pointermove', onTouchPointerMoveCapture, true)
      boundSvg.removeEventListener('pointerup', onTouchPointerEndCapture, true)
      boundSvg.removeEventListener('pointercancel', onTouchPointerEndCapture, true)
      boundSvg.removeEventListener('wheel', onWheel)
      boundSvg.removeEventListener('pointerdown', onPointerDown)
      boundSvg.removeEventListener('pointermove', onPointerMove)
      boundSvg.removeEventListener('pointerup', onPointerUp)
      boundSvg.removeEventListener('pointercancel', onPointerUp)
      boundSvg.removeEventListener('pointerleave', onPointerLeave)
      boundSvg = null
    }
    resizeObserver?.disconnect()
    resizeObserver = null
  }

  function bindSvg(svg: SVGSVGElement | null) {
    unbindSvg()
    svgEl.value = svg
    if (!svg) return

    boundSvg = svg
    svg.addEventListener('pointerdown', onTouchPointerDownCapture, true)
    svg.addEventListener('pointermove', onTouchPointerMoveCapture, true)
    svg.addEventListener('pointerup', onTouchPointerEndCapture, true)
    svg.addEventListener('pointercancel', onTouchPointerEndCapture, true)
    svg.addEventListener('wheel', onWheel, { passive: false })
    svg.addEventListener('pointerdown', onPointerDown)
    svg.addEventListener('pointermove', onPointerMove)
    svg.addEventListener('pointerup', onPointerUp)
    svg.addEventListener('pointercancel', onPointerUp)
    svg.addEventListener('pointerleave', onPointerLeave)

    fit(true)

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (!lastRect || !(pxPerMm.value > 0)) {
          fit(true)
          return
        }
        const rect = svg.getBoundingClientRect()
        if (!(rect.width > 0) || !(rect.height > 0)) return
        const nextRect: ClientRectLike = {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        }
        setViewBox(resizeViewBox(viewBox.value, lastRect, nextRect, pxPerMm.value))
      })
      resizeObserver.observe(svg)
    }
  }

  if (import.meta.client) {
    onMounted(() => {
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
      window.addEventListener('blur', onWindowBlur)
    })
    onBeforeUnmount(() => {
      stopAnim()
      unbindSvg()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onWindowBlur)
    })
  }

  return {
    svgEl,
    viewBox,
    pxPerMm,
    showGrid,
    tool,
    spaceDown,
    isPanning,
    isPinching,
    isPanMode,
    cursorWorld,
    cursorInside,
    gridStep,
    gridStepLabel,
    zoomPercent,
    coordLabel,
    bindSvg,
    setViewBox,
    animateViewBox,
    fit,
    zoomToSelection,
    zoomToPoint,
    zoomIn,
    zoomOut,
    toggleGrid,
    setTool,
  }
}
