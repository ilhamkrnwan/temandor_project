import { readFileSync, statSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

test('export PNG menghasilkan berkas PNG valid berukuran > 0, menampilkan dialog File siap, dan tombol Kirim gambar PNG fallback ke unduh', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  await page.goto('/editor/contoh')
  await expect(page.locator('#cad')).toBeVisible()

  // 1. Buka dialog Export, pilih format PNG lalu klik Export -> unduhan PNG berukuran > 0 dan header PNG valid
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await page.getByTestId('export-fmt-png').click()
  await expect(page.getByTestId('export-filename')).toHaveText('contoh-kantor-lt-2.png')

  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('export-submit-btn').click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toBe('contoh-kantor-lt-2.png')
  const filePath = await download.path()
  expect(filePath).toBeTruthy()
  const stats = statSync(filePath!)
  expect(stats.size).toBeGreaterThan(1000)
  const header = readFileSync(filePath!).subarray(0, 8)
  expect(header.equals(PNG_MAGIC)).toBe(true)

  // 2. Dialog berubah ke keadaan "File siap" + tombol "Kirim gambar PNG"
  const doneBox = page.getByTestId('export-done')
  await expect(doneBox).toBeVisible()
  await expect(doneBox).toContainText('File siap')
  await expect(page.getByTestId('export-done-file')).toHaveText('contoh-kantor-lt-2.png')

  // 3a. Klik "Kirim gambar PNG" saat Web Share API tersedia -> mengirim File PNG valid
  await page.evaluate(() => {
    const sharedCalls: Array<{ name: string, type: string, size: number, title?: string }> = []
    ;(window as unknown as Record<string, unknown>).__temandorShared = sharedCalls
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (data?: ShareData) => Boolean(data?.files && data.files.length > 0),
    })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        const file = data.files?.[0]
        if (file) {
          sharedCalls.push({
            name: file.name,
            type: file.type,
            size: file.size,
            title: data.title,
          })
        }
      },
    })
  })
  await page.getByTestId('export-share-png').click()
  await expect.poll(async () => (
    page.evaluate(() => ((window as unknown as Record<string, unknown>).__temandorShared as Array<unknown>)?.length ?? 0)
  )).toBe(1)
  const sharedPayload = await page.evaluate(() => (
    ((window as unknown as Record<string, unknown>).__temandorShared as Array<{ name: string, type: string, size: number, title?: string }>)[0]
  ))
  expect(sharedPayload?.name).toBe('contoh-kantor-lt-2.png')
  expect(sharedPayload?.type).toBe('image/png')
  expect(sharedPayload?.size).toBeGreaterThan(1000)

  // 3b. Klik "Kirim gambar PNG" tanpa dukungan Web Share file -> fallback unduh PNG valid
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    })
  })
  const shareDownloadPromise = page.waitForEvent('download')
  await page.getByTestId('export-share-png').click()
  const shareDownload = await shareDownloadPromise
  expect(shareDownload.suggestedFilename()).toBe('contoh-kantor-lt-2.png')
  const sharePath = await shareDownload.path()
  expect(statSync(sharePath!).size).toBeGreaterThan(1000)

  // 4. Kembali ke Format lain lalu tutup dialog
  await page.getByTestId('export-again-btn').click()
  await expect(page.getByTestId('export-fmt-png')).toBeVisible()
  await page.getByRole('button', { name: 'Tutup', exact: true }).click()

  // 5. Tidak ada overflow horizontal pada desktop maupun HP
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  expect(errors).toEqual([])
})
