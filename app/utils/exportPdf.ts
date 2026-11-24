import {
  buildPdfKopMetadata,
  computePdfLayout,
  defaultPdfScale,
  docSVG,
  sanitizePdfText,
  type LayerKey,
  type PdfLayout,
  type PdfOrientation,
  type PdfPaper,
  type PdfScaleOption,
  type Project,
} from '#shared/cad'
import { downloadBlobFile, projectSlug } from './projectFiles'

export interface PdfExportOptions {
  paper?: PdfPaper
  orientation?: PdfOrientation
  scale?: PdfScaleOption
  layers?: ReadonlySet<LayerKey>
  date?: Date
  compress?: boolean
}

export interface PdfExportResult {
  blob: Blob
  filename: string
  layout: PdfLayout
}

/**
 * Muat `jspdf` dan `svg2pdf.js` secara lazy (hanya saat export PDF dipanggil)
 * supaya bundle awal editor tetap kecil.
 */
async function loadPdfLibraries() {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([
    import('jspdf'),
    import('svg2pdf.js'),
  ])
  return { jsPDF, svg2pdf }
}

/**
 * Render proyek menjadi PDF vektor berskala dengan bingkai ganda & kop di pojok kanan bawah.
 *
 * Transformasi SVG ke PDF memakai satuan `mm` sehingga pada skala `1:100`,
 * objek sepanjang `9000 mm` di dunia CAD terukur tepat `90 mm` di kertas PDF.
 */
export async function renderProjectPdfBlob(
  project: Project,
  options: PdfExportOptions = {},
): Promise<PdfExportResult> {
  const paper: PdfPaper = options.paper ?? 'A3'
  const orientation: PdfOrientation = options.orientation ?? 'landscape'
  const scale: PdfScaleOption = options.scale ?? defaultPdfScale(project.scale)

  // Hitung viewBox awal untuk mengetahui skala kertas & ketebalan garis cetak
  const baseSvg = docSVG(project, {
    pal: 'paper',
    layers: options.layers,
    note: false,
  })
  const layout = computePdfLayout(baseSvg.vb, { paper, orientation, scale })

  // Render ulang SVG dengan ketebalan garis yang proporsional terhadap skala kertas PDF
  const { svg, vb } = docSVG(project, {
    pal: 'paper',
    layers: options.layers,
    note: false,
    sw: layout.strokeWorldMm,
  })

  const { jsPDF, svg2pdf } = await loadPdfLibraries()
  const doc = new jsPDF({
    orientation: layout.orientation,
    unit: 'mm',
    format: layout.paper.toLowerCase() as 'a4' | 'a3',
    compress: options.compress ?? true,
  })

  doc.setProperties({
    title: sanitizePdfText(project.name),
    subject: `Sketsa bantu ducting (${layout.scaleLabel})`,
    creator: 'Temandor',
  })

  // Parse SVG ke elemen DOM untuk dikonversi menjadi vektor PDF
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const svgEl = parsed.documentElement
  if (!svgEl || svgEl.tagName.toLowerCase() !== 'svg') {
    throw new Error('Gagal menyiapkan dokumen SVG untuk export PDF.')
  }

  svgEl.setAttribute('viewBox', vb.join(' '))
  svgEl.setAttribute('width', String(layout.drawRect.w))
  svgEl.setAttribute('height', String(layout.drawRect.h))
  svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet')

  // Tempel sementara di luar layar agar `getComputedStyle` selalu konsisten lintas browser
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-99999px;top:-99999px;visibility:hidden;pointer-events:none;'
  host.appendChild(svgEl)
  document.body.appendChild(host)

  try {
    // Klip area gambar ke dalam bingkai dalam supaya skala tetap akurat meski gambar lebih besar dari kertas
    doc.saveGraphicsState()
    doc.rect(
      layout.innerFrame.x,
      layout.innerFrame.y,
      layout.innerFrame.w,
      layout.innerFrame.h,
      null,
    )
    doc.clip()
    doc.discardPath()

    await svg2pdf(svgEl, doc, {
      x: layout.drawRect.x,
      y: layout.drawRect.y,
      width: layout.drawRect.w,
      height: layout.drawRect.h,
      loadExternalStyleSheets: false,
      loadImages: false,
    })

    doc.restoreGraphicsState()
  }
  finally {
    host.remove()
  }

  // Bingkai ganda lembar gambar (gaya DESIGN.md: Lembar Gambar Mandor)
  doc.setDrawColor(23, 25, 28) // ink
  doc.setLineWidth(0.5)
  doc.rect(layout.outerFrame.x, layout.outerFrame.y, layout.outerFrame.w, layout.outerFrame.h, 'S')

  doc.setDrawColor(100, 98, 93) // muted
  doc.setLineWidth(0.2)
  doc.rect(layout.innerFrame.x, layout.innerFrame.y, layout.innerFrame.w, layout.innerFrame.h, 'S')

  // Kop / title block pojok kanan bawah
  drawPdfKop(doc, project, layout, options.date)

  const arrayBuffer = doc.output('arraybuffer')
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' })
  const filename = `${projectSlug(project.name)}.pdf`

  return { blob, filename, layout }
}

/** Gambar kop lembar gambar di pojok kanan bawah mengikuti palet DESIGN.md. */
function drawPdfKop(
  doc: import('jspdf').jsPDF,
  project: Project,
  layout: PdfLayout,
  date?: Date,
) {
  const { kop } = layout
  const meta = buildPdfKopMetadata(project.name, project.unit, layout, date)

  const headerH = 7.5
  const nameRowH = 9.5
  const metaRowH = 9.5
  const stampRowH = kop.h - headerH - nameRowH - metaRowH

  // Latar putih kop agar tetap terbaca bersih di atas garis gambar
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(23, 25, 28)
  doc.setLineWidth(0.45)
  doc.rect(kop.x, kop.y, kop.w, kop.h, 'FD')

  // Baris 1: header gelap cad-ground + garis aksen hazard kuning
  doc.setFillColor(20, 23, 27) // cad-ground
  doc.rect(kop.x, kop.y, kop.w, headerH, 'F')
  doc.setFillColor(242, 194, 0) // hazard
  doc.rect(kop.x, kop.y, kop.w, 1.0, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(242, 194, 0)
  doc.text('TEMANDOR', kop.x + 3, kop.y + 5.6)

  doc.setFont('courier', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(255, 255, 255)
  doc.text('LEMBAR GAMBAR', kop.x + kop.w - 3, kop.y + 5.4, { align: 'right' })

  // Baris 2: nama proyek
  const yNameTop = kop.y + headerH
  const yMetaTop = yNameTop + nameRowH
  doc.setDrawColor(23, 25, 28)
  doc.setLineWidth(0.25)
  doc.line(kop.x, yMetaTop, kop.x + kop.w, yMetaTop)

  doc.setFont('courier', 'bold')
  doc.setFontSize(5.5)
  doc.setTextColor(100, 98, 93) // muted
  doc.text('PROYEK', kop.x + 3, yNameTop + 3.1)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(23, 25, 28) // ink
  const nameLines = doc.splitTextToSize(meta.projectName, kop.w - 6) as string[]
  doc.text(nameLines[0] ?? meta.projectName, kop.x + 3, yNameTop + 7.6)

  // Baris 3: Skala | Satuan | Tanggal
  const yStampTop = yMetaTop + metaRowH
  const col1W = kop.w * 0.34
  const col2W = kop.w * 0.36
  const xCol2 = kop.x + col1W
  const xCol3 = xCol2 + col2W

  doc.setDrawColor(23, 25, 28)
  doc.setLineWidth(0.2)
  doc.line(xCol2, yMetaTop, xCol2, yStampTop)
  doc.line(xCol3, yMetaTop, xCol3, yStampTop)
  doc.setLineWidth(0.25)
  doc.line(kop.x, yStampTop, kop.x + kop.w, yStampTop)

  doc.setFont('courier', 'bold')
  doc.setFontSize(5.5)
  doc.setTextColor(100, 98, 93)
  doc.text('SKALA', kop.x + 3, yMetaTop + 3.1)
  doc.text('SATUAN', xCol2 + 2.5, yMetaTop + 3.1)
  doc.text('TANGGAL', xCol3 + 2.5, yMetaTop + 3.1)

  doc.setFont('courier', 'bold')
  doc.setFontSize(6.8)
  doc.setTextColor(23, 25, 28)
  doc.text(meta.scaleLabel, kop.x + 3, yMetaTop + 7.4)
  doc.text(meta.unitLabel, xCol2 + 2.5, yMetaTop + 7.4)
  doc.text(meta.dateLabel, xCol3 + 2.5, yMetaTop + 7.4)

  // Baris 4: stempel sketsa bantu (latar paper hangat + penanda kuning hazard di kiri)
  doc.setFillColor(243, 242, 238) // paper
  doc.rect(kop.x + 0.25, yStampTop + 0.15, kop.w - 0.5, stampRowH - 0.35, 'F')
  doc.setFillColor(242, 194, 0) // hazard
  doc.rect(kop.x + 0.25, yStampTop + 0.15, 1.8, stampRowH - 0.35, 'F')

  doc.setFont('courier', 'bold')
  doc.setFontSize(5.6)
  doc.setTextColor(23, 25, 28)
  doc.text(meta.stamp, kop.x + 3.8, yStampTop + stampRowH * 0.64)

  // Garis tepi luar kop agar sudut selalu tajam
  doc.setDrawColor(23, 25, 28)
  doc.setLineWidth(0.45)
  doc.rect(kop.x, kop.y, kop.w, kop.h, 'S')
}

/** Generate & unduh file PDF vektor berskala untuk proyek aktif. */
export async function downloadProjectPdf(
  project: Project,
  options: PdfExportOptions = {},
): Promise<PdfExportResult> {
  const result = await renderProjectPdfBlob(project, options)
  downloadBlobFile(result.filename, result.blob)
  return result
}
