import { readFileSync, statSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const PDF_MAGIC = Buffer.from('%PDF-')

test('export PDF vektor berskala menghasilkan berkas PDF valid dengan pilihan kertas, orientasi, dan skala', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  await page.goto('/editor/contoh')
  await expect(page.locator('#cad')).toBeVisible()

  // 1. Buka dialog Export, pilih format PDF dan atur kertas A4, orientasi Lanskap, skala 1:100
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await page.getByTestId('export-fmt-pdf').click()
  await expect(page.getByTestId('export-filename')).toHaveText('contoh-kantor-lt-2.pdf')

  await page.getByTestId('pdf-paper-A4').click()
  await page.getByTestId('pdf-orient-landscape').click()
  await page.getByTestId('pdf-scale-1:100').click()

  // 2. Klik Export PDF -> berkas PDF valid terunduh dengan header %PDF-
  const downloadPromise = page.waitForEvent('download')
  await page.getByTestId('export-submit-btn').click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toBe('contoh-kantor-lt-2.pdf')
  const filePath = await download.path()
  expect(filePath).toBeTruthy()
  const stats = statSync(filePath!)
  expect(stats.size).toBeGreaterThan(2000)
  const header = readFileSync(filePath!).subarray(0, 5)
  expect(header.equals(PDF_MAGIC)).toBe(true)

  // 3. Dialog masuk ke keadaan "File siap" menampilkan nama file PDF
  const doneBox = page.getByTestId('export-done')
  await expect(doneBox).toBeVisible()
  await expect(doneBox).toContainText('File siap')
  await expect(page.getByTestId('export-done-file')).toHaveText('contoh-kantor-lt-2.pdf')

  // 4. Kembali ke Format lain, coba skala "Muat" pada A3 Potret lalu tutup
  await page.getByTestId('export-again-btn').click()
  await page.getByTestId('pdf-paper-A3').click()
  await page.getByTestId('pdf-orient-portrait').click()
  await page.getByTestId('pdf-scale-fit').click()
  await expect(page.getByTestId('pdf-layout-hint')).toContainText('A3 potret')

  await page.getByRole('button', { name: 'Tutup', exact: true }).click()

  // 5. Tidak ada overflow horizontal pada desktop maupun HP
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  expect(errors).toEqual([])
})
