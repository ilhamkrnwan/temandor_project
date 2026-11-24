import { angOf, dist, worldToLocal } from './geom'
import { createNode } from './model'
import type { DimNode, Point, SketchNode, TextAlign, TextColor, TextNode } from './types'

export type TextPresetKind = 'heading' | 'subheading' | 'body'
export type TextStyleFlag = 'b' | 'it' | 'ul' | 'bx'

export const TEXT_SIZE_OPTIONS: ReadonlyArray<{ value: string, label: string }> = [
  { value: '0.75', label: 'Kecil' },
  { value: '1', label: 'Sedang' },
  { value: '1.5', label: 'Besar' },
  { value: '2.2', label: 'Judul' },
]

export const TEXT_COLOR_OPTIONS: ReadonlyArray<{ value: TextColor, label: string }> = [
  { value: '', label: 'Ikut layer' },
  { value: 'merah', label: 'Merah: revisi / cek lapangan' },
  { value: 'kuning', label: 'Kuning' },
  { value: 'hijau', label: 'Hijau' },
  { value: 'biru', label: 'Biru' },
  { value: 'putih', label: 'Putih (hitam di kertas)' },
]

export const TEXT_ALIGN_OPTIONS: ReadonlyArray<{ value: TextAlign, label: string }> = [
  { value: 'start', label: 'Kiri' },
  { value: 'middle', label: 'Tengah' },
  { value: 'end', label: 'Kanan' },
]

export const TEXT_STYLE_FLAGS: ReadonlyArray<{ key: TextStyleFlag, label: string, short: string }> = [
  { key: 'b', label: 'Tebal (tidak ikut DXF)', short: 'B' },
  { key: 'it', label: 'Miring', short: 'I' },
  { key: 'ul', label: 'Garis bawah', short: 'U' },
  { key: 'bx', label: 'Kotak berlatar: terbaca di atas garis', short: 'A' },
]

/** Buat garis dimensi dari dua titik ujung dan titik posisi garis ukur opsional. */
export function dimFromPoints(
  p1: Point,
  p2: Point,
  offPoint: Point | null,
  defaultTextHeight: number,
): DimNode | null {
  const len = dist(p1, p2)
  if (len < 1) return null
  const dim = createNode('dim', {
    x: p1[0],
    y: p1[1],
    rot: angOf(p1, p2),
    L: Math.round(len * 10) / 10,
  })
  dim.off = offPoint
    ? Math.round(worldToLocal(dim, offPoint)[1])
    : Math.round(-defaultTextHeight * 2)
  return dim
}

/** Buat node teks dari preset panel Teks (judul, subjudul, atau teks biasa). */
export function textFromPreset(position: Point, preset: TextPresetKind = 'body'): TextNode {
  if (preset === 'heading') {
    return createNode('text', { x: position[0], y: position[1], tz: '2.2', b: true, s: 'Judul' })
  }
  if (preset === 'subheading') {
    return createNode('text', { x: position[0], y: position[1], tz: '1.5', s: 'Subjudul' })
  }
  return createNode('text', { x: position[0], y: position[1], tz: '1', s: 'Teks' })
}

/** Buat node coretan tangan bebas (layer `coret` / DXF `MARKUP`) dari titik-titik dunia. */
export function sketchFromWorldPoints(pts: readonly Point[]): SketchNode | null {
  if (pts.length < 2) return null
  const x0 = Math.round(pts[0]![0])
  const y0 = Math.round(pts[0]![1])
  const rel: Point[] = [[0, 0]]
  for (let i = 1; i < pts.length; i++) {
    const rx = Math.round(pts[i]![0] - x0)
    const ry = Math.round(pts[i]![1] - y0)
    const prev = rel[rel.length - 1]!
    if (rx !== prev[0] || ry !== prev[1]) {
      rel.push([rx, ry])
    }
  }
  if (rel.length < 2) return null
  return createNode('sketch', { x: x0, y: y0, pts: rel })
}
