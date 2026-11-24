import { afterEach, describe, expect, it, vi } from 'vitest'
import { demoProject } from '../../shared/cad'
import { computePngCanvasSize, shareOrDownloadPng } from '../../app/utils/exportPng'

describe('export PNG & kirim (M4-04)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('computePngCanvasSize menjaga rasio aspek dan membatasi dimensi maksimum kanvas', () => {
    expect(computePngCanvasSize([0, 0, 16000, 10000], 3200, 4096)).toEqual({
      width: 3200,
      height: 2000,
    })

    // Denah sangat tinggi (potret 1:4) dibatasi tinggi maks 4096 agar aman di HP
    expect(computePngCanvasSize([0, 0, 1000, 4000], 3200, 4096)).toEqual({
      width: 1024,
      height: 4096,
    })
  })

  it('shareOrDownloadPng memakai Web Share API saat didukung, menangani batal, dan fallback ke unduh bila tidak didukung', async () => {
    const project = demoProject()
    const fakeBlob = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' })
    const fakeRender = vi.fn(async () => fakeBlob)

    // 1. Browser mendukung Web Share API dengan file
    const shareSpy = vi.fn(async () => {})
    vi.stubGlobal('navigator', {
      canShare: vi.fn(() => true),
      share: shareSpy,
    })

    const shared = await shareOrDownloadPng(project, { note: true }, fakeRender)
    expect(shared.mode).toBe('shared')
    expect(shared.filename).toBe('contoh-kantor-lt-2.png')
    expect(shared.size).toBe(fakeBlob.size)
    expect(shareSpy).toHaveBeenCalledTimes(1)

    // 2. Pengguna membatalkan dialog share (AbortError) -> mode 'cancelled' tanpa error
    const abortErr = new Error('User cancelled')
    abortErr.name = 'AbortError'
    vi.stubGlobal('navigator', {
      canShare: vi.fn(() => true),
      share: vi.fn(async () => {
        throw abortErr
      }),
    })
    const cancelled = await shareOrDownloadPng(project, { note: true }, fakeRender)
    expect(cancelled.mode).toBe('cancelled')

    // 3. Perangkat tanpa Web Share API -> fallback mengunduh file PNG
    vi.stubGlobal('navigator', {})
    const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-png')
    const revokeUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const downloaded = await shareOrDownloadPng(project, { note: true }, fakeRender)
    expect(downloaded.mode).toBe('downloaded')
    expect(downloaded.filename).toBe('contoh-kantor-lt-2.png')
    expect(createUrlSpy).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeUrlSpy).toHaveBeenCalledWith('blob:test-png')

    // 4. Web Share gagal (bukan AbortError) + memakai preRenderedBlob -> tidak render ulang dan jatuh ke unduh
    const renderAfterCache = vi.fn(async () => fakeBlob)
    const deniedErr = new Error('Permission denied')
    deniedErr.name = 'NotAllowedError'
    vi.stubGlobal('navigator', {
      canShare: vi.fn(() => true),
      share: vi.fn(async () => {
        throw deniedErr
      }),
    })
    const fallbackRes = await shareOrDownloadPng(
      project,
      { note: true, preRenderedBlob: fakeBlob },
      renderAfterCache,
    )
    expect(fallbackRes.mode).toBe('downloaded')
    expect(renderAfterCache).not.toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalledTimes(2)
  })
})
