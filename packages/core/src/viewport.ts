import type { Bounds } from './geom'
import type { Point } from './types'

export type ViewBox = [number, number, number, number]

export interface ClientRectLike {
  left: number
  top: number
  width: number
  height: number
}

export const GRID_STEPS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000] as const

export const MIN_VIEWBOX_WIDTH = 100
export const MAX_VIEWBOX_WIDTH = 500_000

/** Pixel layar per milimeter dunia pada ukuran kanvas saat ini. */
export function pixelsPerMm(vb: readonly [number, number, number, number], clientWidth: number, clientHeight: number): number {
  if (!(clientWidth > 0) || !(clientHeight > 0) || !(vb[2] > 0) || !(vb[3] > 0)) return 1
  return Math.min(clientWidth / vb[2], clientHeight / vb[3]) || 1
}

/** Langkah grid minor (mm) yang selalu menjaga jarak layar minimal 12 px (sama dengan prototype). */
export function adaptiveGridStep(ppu: number): number {
  for (const step of GRID_STEPS) {
    if (step * ppu >= 12) return step
  }
  return 20_000
}

/** Format langkah grid untuk status bar (`Grid 100 mm`, `Grid 1 m`). */
export function formatGridStep(stepMm: number): string {
  return stepMm >= 1000 ? `Grid ${stepMm / 1000} m` : `Grid ${stepMm} mm`
}

/** Hitung viewBox untuk memuat seluruh `bounds` dengan margin standar editor. */
export function fitViewBox(bounds: Bounds, marginRatio = 0.08, marginMin = 500): ViewBox {
  const w = Math.max(1, bounds[2] - bounds[0])
  const h = Math.max(1, bounds[3] - bounds[1])
  const margin = Math.max(w, h) * marginRatio + marginMin
  return [bounds[0] - margin, bounds[1] - margin, w + 2 * margin, h + 2 * margin]
}

function clampZoomFactor(currentWidth: number, factor: number): number {
  const targetWidth = currentWidth * factor
  if (targetWidth < MIN_VIEWBOX_WIDTH) return MIN_VIEWBOX_WIDTH / currentWidth
  if (targetWidth > MAX_VIEWBOX_WIDTH) return MAX_VIEWBOX_WIDTH / currentWidth
  return factor
}

/** Zoom viewBox sebesar `factor` (< 1 perbesar, > 1 perkecil) sambil menahan `anchorWorld` tetap di titik kursor. */
export function zoomViewBoxAt(vb: ViewBox, anchorWorld: Point, factor: number): ViewBox {
  const k = clampZoomFactor(vb[2], factor)
  return [
    anchorWorld[0] - (anchorWorld[0] - vb[0]) * k,
    anchorWorld[1] - (anchorWorld[1] - vb[1]) * k,
    vb[2] * k,
    vb[3] * k,
  ]
}

/** Zoom viewBox sebesar `factor` terhadap pusat viewport saat ini. */
export function zoomViewBoxCenter(vb: ViewBox, factor: number): ViewBox {
  const center: Point = [vb[0] + vb[2] / 2, vb[1] + vb[3] / 2]
  return zoomViewBoxAt(vb, center, factor)
}

/** Hitung viewBox untuk zoom ke bounding box pilihan dengan tetap menjaga rasio aspek viewport. */
export function zoomViewBoxToBounds(vb: ViewBox, bounds: Bounds): ViewBox {
  const bw = bounds[2] - bounds[0]
  const bh = bounds[3] - bounds[1]
  const margin = Math.max(bw, bh) * 0.25 + 400
  const aspect = vb[3] > 0 ? vb[2] / vb[3] : 1
  const width = Math.min(
    MAX_VIEWBOX_WIDTH,
    Math.max(MIN_VIEWBOX_WIDTH, bw + 2 * margin, (bh + 2 * margin) * aspect),
  )
  const height = width / aspect
  const cx = (bounds[0] + bounds[2]) / 2
  const cy = (bounds[1] + bounds[3]) / 2
  return [cx - width / 2, cy - height / 2, width, height]
}

/** Pusatkan viewBox pada titik dunia tertentu dengan lebar maksimal `maxWidth` mm (untuk fokus warning). */
export function zoomViewBoxToPoint(vb: ViewBox, point: Point, maxWidth = 7000): ViewBox {
  const width = Math.min(vb[2], Math.max(MIN_VIEWBOX_WIDTH, maxWidth))
  const ratio = vb[2] > 0 && vb[3] > 0 ? vb[3] / vb[2] : 1
  const height = width * ratio
  return [point[0] - width / 2, point[1] - height / 2, width, height]
}

/** Geser viewBox berdasarkan perpindahan pointer layar (`deltaClientX`, `deltaClientY`). */
export function panViewBox(startVb: ViewBox, deltaClientX: number, deltaClientY: number, ppu: number): ViewBox {
  const inv = 1 / (ppu || 1)
  return [
    startVb[0] - deltaClientX * inv,
    startVb[1] - deltaClientY * inv,
    startVb[2],
    startVb[3],
  ]
}

/** Konversi titik pointer klien (`clientX`, `clientY`) ke koordinat dunia SVG (`xMidYMid meet`). */
export function clientToWorld(
  vb: readonly [number, number, number, number],
  rect: ClientRectLike,
  clientX: number,
  clientY: number,
): Point {
  if (!(rect.width > 0) || !(rect.height > 0) || !(vb[2] > 0) || !(vb[3] > 0)) return [0, 0]
  const scale = pixelsPerMm(vb, rect.width, rect.height)
  const offsetX = (rect.width - vb[2] * scale) / 2
  const offsetY = (rect.height - vb[3] * scale) / 2
  return [
    vb[0] + (clientX - rect.left - offsetX) / scale,
    vb[1] + (clientY - rect.top - offsetY) / scale,
  ]
}

/** Gabungkan geser titik tengah + zoom dua jari (`pinch`) dalam satu langkah sinkron murni. */
export function pinchViewBox(
  vb: ViewBox,
  rect: ClientRectLike,
  prevMidClient: Point,
  nextMidClient: Point,
  prevDist: number,
  nextDist: number,
): ViewBox {
  const ppu = pixelsPerMm(vb, rect.width, rect.height)
  const panned = panViewBox(vb, nextMidClient[0] - prevMidClient[0], nextMidClient[1] - prevMidClient[1], ppu)
  const anchor = clientToWorld(panned, rect, nextMidClient[0], nextMidClient[1])
  const factor = (prevDist || 1) / (nextDist || 1)
  return zoomViewBoxAt(panned, anchor, factor)
}

/** Pertahankan skala & posisi gambar di layar ketika ukuran kanvas berubah (panel buka/tutup, resize jendela). */
export function resizeViewBox(
  vb: ViewBox,
  prevBox: ClientRectLike,
  nextBox: ClientRectLike,
  pxPerMm: number,
): ViewBox {
  if (!(pxPerMm > 0) || !(nextBox.width > 0) || !(nextBox.height > 0)) return vb
  const x0 = vb[0] - (prevBox.width / pxPerMm - vb[2]) / 2
  const y0 = vb[1] - (prevBox.height / pxPerMm - vb[3]) / 2
  return [
    x0 - (prevBox.left - nextBox.left) / pxPerMm,
    y0 - (prevBox.top - nextBox.top) / pxPerMm,
    nextBox.width / pxPerMm,
    nextBox.height / pxPerMm,
  ]
}
