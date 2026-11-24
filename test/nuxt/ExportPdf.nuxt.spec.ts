import { describe, expect, it } from 'vitest'
import { PDF_STAMP_TEXT, demoProject, newProject } from '../../shared/cad'
import { renderProjectPdfBlob } from '../../app/utils/exportPdf'

const PT_PER_MM = 72 / 25.4

describe('export PDF vektor berskala + kop (M4-05)', () => {
  it('merender PDF vektor valid dengan ruangan 9000 mm terukur tepat 90 mm di skala 1:100 dan kop lengkap', async () => {
    const project = newProject({
      name: 'Ruang Uji 9m',
      W: 9000,
      H: 6000,
      unit: 'mm',
      scale: '1:100',
    })

    const result = await renderProjectPdfBlob(project, {
      paper: 'A4',
      orientation: 'landscape',
      scale: '1:100',
      date: new Date(2026, 10, 23),
      compress: false,
    })

    expect(result.filename).toBe('ruang-uji-9m.pdf')
    expect(result.blob.type).toBe('application/pdf')
    expect(result.blob.size).toBeGreaterThan(2000)
    expect(result.layout.mmPerWorldMm).toBeCloseTo(0.01, 10)
    expect(result.layout.clipped).toBe(false)

    const rawPdf = new TextDecoder('latin1').decode(await result.blob.arrayBuffer())
    expect(rawPdf.startsWith('%PDF-')).toBe(true)

    // Verifikasi MediaBox A4 lanskap = 297 x 210 mm dalam poin PDF
    const mediaBoxMatch = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(rawPdf)
    expect(mediaBoxMatch).not.toBeNull()
    expect(Number(mediaBoxMatch![1])).toBeCloseTo(297 * PT_PER_MM, 1)
    expect(Number(mediaBoxMatch![2])).toBeCloseTo(210 * PT_PER_MM, 1)

    // Verifikasi teks kop & stempel sketsa bantu muncul di aliran PDF
    expect(rawPdf).toContain('TEMANDOR')
    expect(rawPdf).toContain('Ruang Uji 9m')
    expect(rawPdf).toContain('1:100')
    expect(rawPdf).toContain('23 Nov 2026')
    expect(rawPdf).toContain(PDF_STAMP_TEXT)

    // Verifikasi transformasi vektor SVG->PDF:
    // 1. Matriks luar jsPDF mengonversi satuan mm -> poin PDF (72 / 25.4 ≈ 2.83465 pt/mm)
    // 2. Matriks dalam svg2pdf mengonversi dunia (mm) -> kertas (mm) dengan faktor tepat 0.01 (1:100)
    // 3. Jalur dinding ruangan mencakup segmen 9000 world-mm -> 9000 * 0.01 = tepat 90.00 mm di PDF.
    const cmMatches = [...rawPdf.matchAll(/([\d.-]+) 0\.? 0\.? ([\d.-]+) [\d.-]+ [\d.-]+ cm/g)]
    const hasMmToPtMatrix = cmMatches.some((m) => {
      const sx = Math.abs(Number(m[1]))
      const sy = Math.abs(Number(m[2]))
      return Math.abs(sx - PT_PER_MM) < 0.001 && Math.abs(sy - PT_PER_MM) < 0.001
    })
    const hasExact1To100Matrix = cmMatches.some((m) => {
      const sx = Math.abs(Number(m[1]))
      const sy = Math.abs(Number(m[2]))
      return Math.abs(sx - 0.01) < 1e-6 && Math.abs(sy - 0.01) < 1e-6
    })
    expect(hasMmToPtMatrix).toBe(true)
    expect(hasExact1To100Matrix).toBe(true)
    expect(rawPdf).toContain('9000. 0. l')
    expect(rawPdf).toContain('9000. 6000. l')
  })

  it('merender proyek contoh (demoProject) pada kertas A3 lanskap dan mode muat ke kertas tanpa error', async () => {
    const demo = demoProject()

    const fitted = await renderProjectPdfBlob(demo, {
      paper: 'A3',
      orientation: 'landscape',
      scale: 'fit',
      compress: false,
    })

    expect(fitted.filename).toBe('contoh-kantor-lt-2.pdf')
    expect(fitted.blob.size).toBeGreaterThan(5000)
    expect(fitted.layout.clipped).toBe(false)
    expect(fitted.layout.overlapsKop).toBe(false)

    const rawPdf = new TextDecoder('latin1').decode(await fitted.blob.arrayBuffer())
    const mediaBoxMatch = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(rawPdf)
    expect(mediaBoxMatch).not.toBeNull()
    expect(Number(mediaBoxMatch![1])).toBeCloseTo(420 * PT_PER_MM, 1)
    expect(Number(mediaBoxMatch![2])).toBeCloseTo(297 * PT_PER_MM, 1)
    expect(rawPdf).toContain('Contoh - Kantor Lt. 2')
    expect(rawPdf).toContain(PDF_STAMP_TEXT)
  })
})
