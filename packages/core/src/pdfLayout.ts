import type { Bounds } from './geom'
import type { Point, Unit } from './types'

export type PdfPaper = 'A4' | 'A3'
export type PdfOrientation = 'portrait' | 'landscape'
export type PdfScaleOption = '1:50' | '1:100' | '1:200' | 'fit'

export interface PdfRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface PdfLayoutOptions {
  paper?: PdfPaper
  orientation?: PdfOrientation
  scale?: PdfScaleOption
}

export interface PdfLayout {
  readonly paper: PdfPaper
  readonly orientation: PdfOrientation
  readonly scaleOption: PdfScaleOption
  readonly pageWidthMm: number
  readonly pageHeightMm: number
  readonly outerFrame: PdfRect
  readonly innerFrame: PdfRect
  readonly kop: PdfRect
  readonly drawRect: PdfRect
  readonly mmPerWorldMm: number
  readonly effectiveScaleDenom: number
  readonly scaleLabel: string
  readonly clipped: boolean
  readonly overlapsKop: boolean
  readonly strokeWorldMm: number
}

export interface PdfKopMetadata {
  readonly projectName: string
  readonly scaleLabel: string
  readonly unitLabel: string
  readonly dateLabel: string
  readonly stamp: string
}

export const PDF_PAPERS: Readonly<Record<PdfPaper, { readonly shortMm: number, readonly longMm: number }>> = {
  A4: { shortMm: 210, longMm: 297 },
  A3: { shortMm: 297, longMm: 420 },
}

export const PDF_SCALE_OPTIONS: readonly PdfScaleOption[] = ['1:50', '1:100', '1:200', 'fit'] as const

export const PDF_STAMP_TEXT = 'SKETSA BANTU TEMANDOR - CEK ULANG UKURAN DI LAPANGAN'

const SHEET_MARGIN_MM = 10
const INNER_FRAME_INSET_MM = 1.5
const DRAW_PADDING_MM = 4
const KOP_HEIGHT_MM = 34
const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] as const

/** Ukuran kertas PDF dalam mm sesuai orientasi potret/lanskap. */
export function paperSizeMm(
  paper: PdfPaper,
  orientation: PdfOrientation,
): { widthMm: number, heightMm: number } {
  const dim = PDF_PAPERS[paper]
  return orientation === 'landscape'
    ? { widthMm: dim.longMm, heightMm: dim.shortMm }
    : { widthMm: dim.shortMm, heightMm: dim.longMm }
}

/** Parsing rasio skala berbentuk `1:N` menjadi penyebut `N`, atau `null` untuk `fit`/tidak valid. */
export function parseScaleRatio(scale: string): number | null {
  const match = /^\s*1\s*:\s*(\d+(?:\.\d+)?)\s*$/.exec(scale)
  if (!match) return null
  const denom = Number(match[1])
  return Number.isFinite(denom) && denom > 0 ? denom : null
}

/** Pilih opsi skala PDF bawaan dari properti `project.scale`. */
export function defaultPdfScale(projectScale: string): PdfScaleOption {
  const trimmed = projectScale.trim()
  if (trimmed === '1:50' || trimmed === '1:100' || trimmed === '1:200') {
    return trimmed
  }
  return '1:100'
}

/** Format tanggal singkat bahasa Indonesia (deterministik tanpa bergantung pada ICU browser). */
export function formatPdfDate(date: Date): string {
  const day = date.getDate()
  const month = MONTHS_ID[date.getMonth()] ?? 'Jan'
  const year = date.getFullYear()
  return `${day} ${month} ${year}`
}

function rectsOverlap(a: PdfRect, b: PdfRect): boolean {
  const eps = 1e-6
  return (
    a.x < b.x + b.w - eps
    && a.x + a.w > b.x + eps
    && a.y < b.y + b.h - eps
    && a.y + a.h > b.y + eps
  )
}

function centerInRect(width: number, height: number, container: PdfRect): PdfRect {
  return {
    x: container.x + (container.w - width) / 2,
    y: container.y + (container.h - height) / 2,
    w: width,
    h: height,
  }
}

/**
 * Hitung tata letak lembar PDF, bingkai gambar, kop pojok kanan bawah, dan transformasi skala
 * dunia (mm) ke milimeter kertas PDF.
 *
 * Untuk skala tetap (`1:50`, `1:100`, `1:200`), faktor skala selalu tepat `1 / N`:
 * panjang 9000 mm pada skala `1:100` menghasilkan tepat `90 mm` di PDF.
 */
export function computePdfLayout(
  viewBox: Bounds,
  options: PdfLayoutOptions = {},
): PdfLayout {
  const paper: PdfPaper = options.paper ?? 'A3'
  const orientation: PdfOrientation = options.orientation ?? 'landscape'
  const scaleOption: PdfScaleOption = options.scale ?? '1:100'

  const { widthMm: pageWidthMm, heightMm: pageHeightMm } = paperSizeMm(paper, orientation)
  const outerFrame: PdfRect = {
    x: SHEET_MARGIN_MM,
    y: SHEET_MARGIN_MM,
    w: pageWidthMm - 2 * SHEET_MARGIN_MM,
    h: pageHeightMm - 2 * SHEET_MARGIN_MM,
  }
  const innerFrame: PdfRect = {
    x: outerFrame.x + INNER_FRAME_INSET_MM,
    y: outerFrame.y + INNER_FRAME_INSET_MM,
    w: outerFrame.w - 2 * INNER_FRAME_INSET_MM,
    h: outerFrame.h - 2 * INNER_FRAME_INSET_MM,
  }

  const kopWidthMm = paper === 'A3' ? 132 : 118
  const kop: PdfRect = {
    x: innerFrame.x + innerFrame.w - kopWidthMm,
    y: innerFrame.y + innerFrame.h - KOP_HEIGHT_MM,
    w: kopWidthMm,
    h: KOP_HEIGHT_MM,
  }

  const vbW = viewBox[2] > 0 ? viewBox[2] : 1000
  const vbH = viewBox[3] > 0 ? viewBox[3] : 1000

  const aboveKopArea: PdfRect = {
    x: innerFrame.x + DRAW_PADDING_MM,
    y: innerFrame.y + DRAW_PADDING_MM,
    w: Math.max(10, innerFrame.w - 2 * DRAW_PADDING_MM),
    h: Math.max(10, kop.y - innerFrame.y - 2 * DRAW_PADDING_MM),
  }
  const leftOfKopArea: PdfRect = {
    x: innerFrame.x + DRAW_PADDING_MM,
    y: innerFrame.y + DRAW_PADDING_MM,
    w: Math.max(10, kop.x - innerFrame.x - 2 * DRAW_PADDING_MM),
    h: Math.max(10, innerFrame.h - 2 * DRAW_PADDING_MM),
  }
  const fullInnerArea: PdfRect = {
    x: innerFrame.x + DRAW_PADDING_MM,
    y: innerFrame.y + DRAW_PADDING_MM,
    w: Math.max(10, innerFrame.w - 2 * DRAW_PADDING_MM),
    h: Math.max(10, innerFrame.h - 2 * DRAW_PADDING_MM),
  }

  const fixedDenom = scaleOption === 'fit' ? null : parseScaleRatio(scaleOption)
  let mmPerWorldMm: number
  let effectiveScaleDenom: number
  let scaleLabel: string
  let drawRect: PdfRect
  let clipped = false
  let overlapsKop = false

  if (fixedDenom !== null) {
    mmPerWorldMm = 1 / fixedDenom
    effectiveScaleDenom = fixedDenom
    scaleLabel = `1:${fixedDenom}`
    const drawW = vbW * mmPerWorldMm
    const drawH = vbH * mmPerWorldMm

    if (drawW <= aboveKopArea.w + 1e-6 && drawH <= aboveKopArea.h + 1e-6) {
      drawRect = centerInRect(drawW, drawH, aboveKopArea)
    }
    else if (drawW <= leftOfKopArea.w + 1e-6 && drawH <= leftOfKopArea.h + 1e-6) {
      drawRect = centerInRect(drawW, drawH, leftOfKopArea)
    }
    else {
      drawRect = centerInRect(drawW, drawH, fullInnerArea)
      clipped = drawW > innerFrame.w + 1e-6 || drawH > innerFrame.h + 1e-6
      overlapsKop = rectsOverlap(drawRect, kop)
    }
  }
  else {
    const scaleAbove = Math.min(aboveKopArea.w / vbW, aboveKopArea.h / vbH)
    const scaleLeft = Math.min(leftOfKopArea.w / vbW, leftOfKopArea.h / vbH)
    const useAbove = scaleAbove >= scaleLeft
    mmPerWorldMm = useAbove ? scaleAbove : scaleLeft
    effectiveScaleDenom = 1 / mmPerWorldMm
    const roundedDenom = Math.max(1, Math.round(effectiveScaleDenom))
    scaleLabel = `Muat (1:${roundedDenom})`
    const drawW = vbW * mmPerWorldMm
    const drawH = vbH * mmPerWorldMm
    drawRect = centerInRect(drawW, drawH, useAbove ? aboveKopArea : leftOfKopArea)
  }

  // Ketebalan garis cetak konsisten ~0,20 mm di kertas (dibatasi agar tidak terlalu tebal di skala kecil)
  const targetPaperStrokeMm = 0.2
  const strokeWorldMm = Math.max(4, Math.min(vbW / 450, targetPaperStrokeMm / mmPerWorldMm))

  return {
    paper,
    orientation,
    scaleOption,
    pageWidthMm,
    pageHeightMm,
    outerFrame,
    innerFrame,
    kop,
    drawRect,
    mmPerWorldMm,
    effectiveScaleDenom,
    scaleLabel,
    clipped,
    overlapsKop,
    strokeWorldMm,
  }
}

/** Konversi satu koordinat dunia (mm) ke posisi (mm) di lembar PDF. */
export function worldToPdfPoint(layout: PdfLayout, viewBox: Bounds, pt: Point): Point {
  const scaleX = layout.drawRect.w / viewBox[2]
  const scaleY = layout.drawRect.h / viewBox[3]
  return [
    layout.drawRect.x + (pt[0] - viewBox[0]) * scaleX,
    layout.drawRect.y + (pt[1] - viewBox[1]) * scaleY,
  ]
}

/** Konversi jarak dunia (mm) menjadi panjang terukur (mm) di lembar PDF. */
export function worldLengthToPdfMm(layout: PdfLayout, lengthWorldMm: number): number {
  return lengthWorldMm * layout.mmPerWorldMm
}

/** Normalisasi tanda baca Unicode di luar rentang Latin-1 agar font standar Type1 PDF selalu terbaca rapi. */
export function sanitizePdfText(text: string): string {
  return text
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/[\u2018\u2019]/g, '\'')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2192/g, '->')
}

/** Susun teks kop lembar gambar PDF dari proyek & tata letak aktif. */
export function buildPdfKopMetadata(
  projectName: string,
  unit: Unit,
  layout: PdfLayout,
  date: Date = new Date(),
): PdfKopMetadata {
  return {
    projectName: sanitizePdfText(projectName.trim() || 'Proyek tanpa nama'),
    scaleLabel: layout.scaleLabel,
    unitLabel: `Duct ${unit} · Model mm`,
    dateLabel: formatPdfDate(date),
    stamp: PDF_STAMP_TEXT,
  }
}
