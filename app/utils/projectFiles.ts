import {
  docSVG,
  openProjectJson,
  projectFileSlug,
  type OpenProjectResult,
  type PaletteName,
  type Project,
} from '#shared/cad'

/** Ubah nama proyek menjadi slug nama file aman (fallback `proyek-temandor`). */
export function projectSlug(name: string): string {
  return projectFileSlug(name)
}

/** Unduh Blob biner (PNG/PDF) sebagai file dari browser. */
export function downloadBlobFile(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Unduh konten teks (JSON/DXF/CSV) sebagai file dari browser. */
export function downloadTextFile(filename: string, content: string, mime: string): void {
  downloadBlobFile(filename, new Blob([content], { type: mime }))
}

/** Format waktu relatif berbahasa Indonesia untuk daftar proyek. */
export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (diffSec < 60) return 'baru saja'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} menit lalu`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} jam lalu`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay} hari lalu`
  return new Date(timestamp).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Bangun data URL SVG mandiri untuk thumbnail kartu proyek (terisolasi dari DOM tanpa v-html). */
export function projectThumbDataUrl(project: Project, pal: PaletteName = 'screen'): string {
  const { svg } = docSVG(project, { pal, sw: 0 })
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export type ImportProjectResult = OpenProjectResult

/** Parse, migrasi (v1 prototype -> v2), dan validasi file `.json` proyek Temandor dengan ID baru. */
export function parseImportedProjectJson(rawText: string): ImportProjectResult {
  return openProjectJson(rawText, { freshId: true })
}
