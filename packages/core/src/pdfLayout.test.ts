import { describe, expect, it } from 'vitest'
import {
  PDF_STAMP_TEXT,
  buildPdfKopMetadata,
  computePdfLayout,
  defaultPdfScale,
  demoProject,
  docSVG,
  formatPdfDate,
  newProject,
  paperSizeMm,
  parseScaleRatio,
  worldLengthToPdfMm,
  worldToPdfPoint,
} from './index'

describe('tata letak & skala PDF vektor (M4-05)', () => {
  it('ruangan 9000 mm di skala 1:100 terukur tepat 90 mm di PDF (baik A4 maupun A3)', () => {
    const project = newProject({ name: 'Uji Skala 9m', W: 9000, H: 6000, scale: '1:100' })
    const { vb } = docSVG(project, { pal: 'paper', note: false })

    for (const paper of ['A4', 'A3'] as const) {
      const layout = computePdfLayout(vb, { paper, orientation: 'landscape', scale: '1:100' })

      expect(layout.mmPerWorldMm).toBeCloseTo(0.01, 10)
      expect(worldLengthToPdfMm(layout, 9000)).toBeCloseTo(90, 6)
      expect(worldLengthToPdfMm(layout, 6000)).toBeCloseTo(60, 6)

      // Verifikasi transformasi titik sudut ruangan di lembar PDF (tanpa distorsi sumbu X/Y)
      const p0 = worldToPdfPoint(layout, vb, [0, 0])
      const pRight = worldToPdfPoint(layout, vb, [9000, 0])
      const pBottom = worldToPdfPoint(layout, vb, [0, 6000])

      expect(pRight[0] - p0[0]).toBeCloseTo(90, 6)
      expect(pBottom[1] - p0[1]).toBeCloseTo(60, 6)
      expect(layout.drawRect.w / vb[2]).toBeCloseTo(0.01, 10)
      expect(layout.drawRect.h / vb[3]).toBeCloseTo(0.01, 10)
      expect(layout.clipped).toBe(false)
      expect(layout.overlapsKop).toBe(false)
    }
  })

  it('mendukung skala 1:50, 1:200, dan mode muat ke kertas tanpa tumpang tindih dengan kop', () => {
    const demo = demoProject()
    const { vb } = docSVG(demo, { pal: 'paper', note: false })

    const at50 = computePdfLayout(vb, { paper: 'A3', orientation: 'landscape', scale: '1:50' })
    expect(worldLengthToPdfMm(at50, 9000)).toBeCloseTo(180, 6)
    expect(at50.scaleLabel).toBe('1:50')

    const at200 = computePdfLayout(vb, { paper: 'A4', orientation: 'portrait', scale: '1:200' })
    expect(worldLengthToPdfMm(at200, 9000)).toBeCloseTo(45, 6)
    expect(at200.clipped).toBe(false)
    expect(at200.overlapsKop).toBe(false)

    // Skala 1:50 pada A4 potret tetap mempertahankan rasio eksak 1:50 dan menandai terpotong
    const clipped = computePdfLayout(vb, { paper: 'A4', orientation: 'portrait', scale: '1:50' })
    expect(worldLengthToPdfMm(clipped, 9000)).toBeCloseTo(180, 6)
    expect(clipped.clipped).toBe(true)

    // Mode "muat ke kertas" muat di dalam bingkai tanpa menyentuh kop pojok kanan bawah
    for (const paper of ['A4', 'A3'] as const) {
      for (const orientation of ['portrait', 'landscape'] as const) {
        const fit = computePdfLayout(vb, { paper, orientation, scale: 'fit' })
        expect(fit.clipped).toBe(false)
        expect(fit.overlapsKop).toBe(false)
        expect(fit.drawRect.x).toBeGreaterThanOrEqual(fit.innerFrame.x)
        expect(fit.drawRect.y).toBeGreaterThanOrEqual(fit.innerFrame.y)
        expect(fit.drawRect.x + fit.drawRect.w).toBeLessThanOrEqual(fit.innerFrame.x + fit.innerFrame.w + 1e-6)
        expect(fit.drawRect.y + fit.drawRect.h).toBeLessThanOrEqual(fit.innerFrame.y + fit.innerFrame.h + 1e-6)
        expect(fit.scaleLabel).toMatch(/^Muat \(1:\d+\)$/)
      }
    }
  })

  it('menghasilkan dimensi kertas, posisi kop pojok kanan bawah, dan metadata kop yang lengkap', () => {
    expect(paperSizeMm('A4', 'portrait')).toEqual({ widthMm: 210, heightMm: 297 })
    expect(paperSizeMm('A4', 'landscape')).toEqual({ widthMm: 297, heightMm: 210 })
    expect(paperSizeMm('A3', 'portrait')).toEqual({ widthMm: 297, heightMm: 420 })
    expect(paperSizeMm('A3', 'landscape')).toEqual({ widthMm: 420, heightMm: 297 })

    expect(parseScaleRatio('1:100')).toBe(100)
    expect(parseScaleRatio('1:50')).toBe(50)
    expect(parseScaleRatio('fit')).toBeNull()
    expect(defaultPdfScale('1:50')).toBe('1:50')
    expect(defaultPdfScale('1:125')).toBe('1:100')

    const layout = computePdfLayout([0, 0, 12000, 8000], {
      paper: 'A3',
      orientation: 'landscape',
      scale: '1:100',
    })
    // Kop menempel tepat di pojok kanan bawah bingkai dalam
    expect(layout.kop.x + layout.kop.w).toBeCloseTo(layout.innerFrame.x + layout.innerFrame.w, 6)
    expect(layout.kop.y + layout.kop.h).toBeCloseTo(layout.innerFrame.y + layout.innerFrame.h, 6)

    const kop = buildPdfKopMetadata('Kantor Lt. 2', 'inch', layout, new Date(2026, 10, 23))
    expect(kop.projectName).toBe('Kantor Lt. 2')
    expect(kop.scaleLabel).toBe('1:100')
    expect(kop.unitLabel).toBe('Duct inch · Model mm')
    expect(kop.dateLabel).toBe(formatPdfDate(new Date(2026, 10, 23)))
    expect(kop.dateLabel).toBe('23 Nov 2026')
    expect(kop.stamp).toBe(PDF_STAMP_TEXT)
  })
})
