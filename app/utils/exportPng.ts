import { docSVG, type Bounds, type LayerKey, type Project } from '#shared/cad'
import { downloadBlobFile, projectSlug } from './projectFiles'

export const PNG_DEFAULT_WIDTH = 3200
export const PNG_MAX_DIMENSION = 4096

export interface PngExportOptions {
  layers?: ReadonlySet<LayerKey>
  note?: boolean
  targetWidth?: number
  preRenderedBlob?: Blob
}

export interface PngShareResult {
  mode: 'shared' | 'cancelled' | 'downloaded'
  filename: string
  size: number
}

/** Hitung ukuran kanvas PNG yang tajam untuk WhatsApp sambil menjaga batas dimensi maksimum browser. */
export function computePngCanvasSize(
  vb: readonly [number, number, number, number],
  targetWidth = PNG_DEFAULT_WIDTH,
  maxDim = PNG_MAX_DIMENSION,
): { width: number, height: number } {
  const vw = vb[2] > 0 ? vb[2] : 1000
  const vh = vb[3] > 0 ? vb[3] : 1000
  const aspect = vh / vw

  let width = Math.min(maxDim, Math.max(320, Math.round(targetWidth)))
  let height = Math.max(1, Math.round(width * aspect))
  if (height > maxDim) {
    height = maxDim
    width = Math.max(1, Math.round(height / aspect))
  }
  return { width, height }
}

/** Render proyek (palet `paper`) menjadi Blob PNG beresolusi tinggi via SVG -> `<canvas>`. */
export function renderProjectPngBlob(
  project: Project,
  options: PngExportOptions = {},
): Promise<Blob> {
  const { svg, vb } = docSVG(project, {
    pal: 'paper',
    layers: options.layers,
    note: options.note ?? true,
  })
  const { width, height } = computePngCanvasSize(vb as Bounds, options.targetWidth)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Konteks kanvas 2D tidak tersedia untuk export PNG.'))
        return
      }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => {
        if (blob && blob.size > 0) resolve(blob)
        else reject(new Error('Gagal menghasilkan berkas PNG.'))
      }, 'image/png')
    }
    img.onerror = () => reject(new Error('Gagal merender SVG proyek ke gambar PNG.'))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

/**
 * Bagikan gambar PNG lewat Web Share API (HP: WhatsApp, Telegram, email).
 * Jika browser belum mendukung berbagi file, otomatis jatuh kembali ke unduh PNG.
 */
export async function shareOrDownloadPng(
  project: Project,
  options: PngExportOptions = {},
  renderBlob: (p: Project, opts: PngExportOptions) => Promise<Blob> = renderProjectPngBlob,
): Promise<PngShareResult> {
  const filename = `${projectSlug(project.name)}.png`
  const blob = options.preRenderedBlob ?? await renderBlob(project, options)
  const file = new File([blob], filename, { type: 'image/png' })

  if (
    typeof navigator !== 'undefined'
    && typeof navigator.canShare === 'function'
    && typeof navigator.share === 'function'
    && navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: project.name,
        text: `${project.name} - sketsa bantu, cek ulang ukuran di lapangan`,
      })
      return { mode: 'shared', filename, size: blob.size }
    }
    catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { mode: 'cancelled', filename, size: blob.size }
      }
      if (err instanceof Error && err.name === 'AbortError') {
        return { mode: 'cancelled', filename, size: blob.size }
      }
      // Jika browser menolak Web Share (mis. NotAllowedError), fallback ke unduh PNG.
    }
  }

  downloadBlobFile(filename, blob)
  return { mode: 'downloaded', filename, size: blob.size }
}
