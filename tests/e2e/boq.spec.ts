import { readFileSync, statSync } from 'node:fs'
import { expect, test } from '@playwright/test'

test('daftar material (BOQ): dibuka dari panel Proyek, perintah BOQ, dan dialog Export; unduh CSV Indonesia & salin teks WhatsApp', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  await page.goto('/editor/contoh')
  await expect(page.locator('#cad')).toBeVisible()

  // 1. Buka BOQ lewat panel Proyek
  await page.getByRole('button', { name: 'Proyek', exact: true }).click()
  const proyekBoqBtn = page.getByTestId('proyek-open-boq')
  await expect(proyekBoqBtn).toBeVisible()
  await proyekBoqBtn.click()

  const boqBody = page.getByTestId('boq-dialog-body')
  await expect(boqBody).toBeVisible()
  await expect(page.getByTestId('boq-group-duct')).toBeVisible()
  await expect(page.getByTestId('boq-group-fitting')).toBeVisible()
  await expect(page.getByTestId('boq-group-perlengkapan')).toBeVisible()
  await expect(page.getByTestId('boq-group-equipment')).toBeVisible()
  await expect(boqBody).toContainText('Belum termasuk sisa potong, sambungan, dan sealant.')
  await expect(page.getByTestId('boq-summary')).toContainText('duct total')

  // 2. Unduh CSV (Excel Indonesia: BOM UTF-8, pemisah ';', koma desimal)
  const csvDownloadPromise = page.waitForEvent('download')
  await page.getByTestId('boq-csv-btn').click()
  const csvDownload = await csvDownloadPromise
  expect(csvDownload.suggestedFilename()).toBe('contoh-kantor-lt-2-material.csv')
  const csvPath = await csvDownload.path()
  expect(csvPath).toBeTruthy()
  expect(statSync(csvPath!).size).toBeGreaterThan(100)
  const csvContent = readFileSync(csvPath!, 'utf8')
  expect(csvContent.startsWith('\uFEFFKategori;Item;Spesifikasi;Jumlah;Satuan\r\n')).toBe(true)
  expect(csvContent).toContain('Duct;Duct lurus SA;')
  expect(csvContent).toMatch(/;\d+,\d+;m/)

  // 3. Salin teks WhatsApp
  await page.evaluate(() => {
    ;(window as unknown as Record<string, unknown>).__temandorClipboard = ''
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          ;(window as unknown as Record<string, unknown>).__temandorClipboard = text
        },
      },
    })
  })
  await page.getByTestId('boq-copy-btn').click()
  await expect.poll(async () => (
    page.evaluate(() => String((window as unknown as Record<string, unknown>).__temandorClipboard ?? ''))
  )).toContain('Daftar material -')
  const copiedText = await page.evaluate(() => String((window as unknown as Record<string, unknown>).__temandorClipboard ?? ''))
  expect(copiedText).toContain('Duct lurus SA')
  expect(copiedText).toContain('belum termasuk sisa potong')

  await page.getByRole('button', { name: 'Tutup', exact: true }).click()
  await expect(boqBody).toBeHidden()

  // 4. Buka BOQ lewat perintah "BOQ" di baris perintah
  const cmdInput = page.locator('#cmd')
  await cmdInput.click()
  await cmdInput.fill('BOQ')
  await cmdInput.press('Enter')
  await expect(boqBody).toBeVisible()
  await page.getByRole('button', { name: 'Tutup', exact: true }).click()
  await expect(boqBody).toBeHidden()

  // 5. Buka BOQ lewat dialog Export
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const exportBoqBtn = page.getByTestId('export-open-boq')
  await expect(exportBoqBtn).toBeVisible()
  await exportBoqBtn.click()
  await expect(boqBody).toBeVisible()
  await page.getByRole('button', { name: 'Tutup', exact: true }).click()

  // 6. Tidak ada overflow horizontal pada desktop maupun HP
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  expect(errors).toEqual([])
})
