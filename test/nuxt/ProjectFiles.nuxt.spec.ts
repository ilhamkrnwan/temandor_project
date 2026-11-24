import { describe, expect, it } from 'vitest'
import { demoProject, newProject } from '../../shared/cad'
import {
  formatRelativeTime,
  parseImportedProjectJson,
  projectSlug,
  projectThumbDataUrl,
} from '../../app/utils/projectFiles'

describe('utilitas berkas & daftar proyek (M4-01)', () => {
  it('projectSlug menghasilkan nama berkas aman dengan fallback', () => {
    expect(projectSlug('Kantor Lt. 2 - Ducting')).toBe('kantor-lt-2-ducting')
    expect(projectSlug('   ')).toBe('proyek-temandor')
  })

  it('formatRelativeTime memformat jeda waktu dalam bahasa Indonesia', () => {
    const now = 1_700_000_000_000
    expect(formatRelativeTime(now - 20_000, now)).toBe('baru saja')
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5 menit lalu')
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe('3 jam lalu')
    expect(formatRelativeTime(now - 2 * 86_400_000, now)).toBe('2 hari lalu')
  })

  it('projectThumbDataUrl menghasilkan data URL SVG valid dari docSVG', () => {
    const url = projectThumbDataUrl(demoProject(), 'screen')
    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
    const decoded = decodeURIComponent(url.slice('data:image/svg+xml;charset=utf-8,'.length))
    expect(decoded).toContain('<svg ')
    expect(decoded).toContain('FCU-01')
  })

  it('parseImportedProjectJson menerima JSON proyek valid (ID baru) dan menolak file rusak tanpa crash', () => {
    const original = newProject({ name: 'Gudang Utama', unit: 'mm', scale: '1:50' })
    const ok = parseImportedProjectJson(JSON.stringify(original))
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      expect(ok.project.name).toBe('Gudang Utama')
      expect(ok.project.id).not.toBe(original.id)
      expect(ok.project.unit).toBe('mm')
    }

    const badJson = parseImportedProjectJson('{ bukan json')
    expect(badJson.ok).toBe(false)

    const wrongShape = parseImportedProjectJson(JSON.stringify({ hello: 'world' }))
    expect(wrongShape.ok).toBe(false)
  })
})
