import { readFileSync, statSync } from 'node:fs'
import { expect, test } from '@playwright/test'

test('alur lengkap dialog Export: buka proyek contoh -> Export -> pilih layer & satuan -> DXF R12 terunduh', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  await page.goto('/editor/contoh')
  await expect(page.locator('#cad')).toBeVisible()

  // 1. Buka dialog Export -> format bawaan DXF, nama file pratinjau .dxf
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(page.getByTestId('export-fmt-dxf')).toBeVisible()
  await expect(page.getByTestId('export-filename')).toHaveText('contoh-kantor-lt-2.dxf')
  await expect(page.getByTestId('export-dxf-unit')).toHaveValue('mm')
  await expect(page.getByTestId('export-layer-sa')).toBeChecked()
  await expect(page.getByTestId('export-layer-ea')).toBeChecked()

  // 2. Klik Export DXF -> file DXF R12 valid terunduh dengan semua layer utama
  const dxfDownloadPromise = page.waitForEvent('download')
  await page.getByTestId('export-submit-btn').click()
  const dxfDownload = await dxfDownloadPromise

  expect(dxfDownload.suggestedFilename()).toBe('contoh-kantor-lt-2.dxf')
  const dxfPath = await dxfDownload.path()
  expect(dxfPath).toBeTruthy()
  expect(statSync(dxfPath!).size).toBeGreaterThan(5000)

  const dxfContent = readFileSync(dxfPath!, 'utf8')
  expect(dxfContent).toContain('AC1009')
  expect(dxfContent).toContain('DUCT-SA')
  expect(dxfContent).toContain('DUCT-EA')
  expect(dxfContent).toContain('SKETSA BANTU TEMANDOR')
  expect(dxfContent.trimEnd().endsWith('EOF')).toBe(true)

  // 3. Dialog masuk ke keadaan "File siap"
  await expect(page.getByTestId('export-done')).toBeVisible()
  await expect(page.getByTestId('export-done-file')).toHaveText('contoh-kantor-lt-2.dxf')

  // 4. Kembali ke Format lain, matikan layer EA dan ganti satuan DXF ke inch -> hasil DXF mematuhi filter layer & INSUNITS=1
  await page.getByTestId('export-again-btn').click()
  await page.getByTestId('export-layer-ea').uncheck()
  await page.getByTestId('export-dxf-unit').selectOption('inch')

  const inchDownloadPromise = page.waitForEvent('download')
  await page.getByTestId('export-submit-btn').click()
  const inchDownload = await inchDownloadPromise
  const inchPath = await inchDownload.path()
  const inchDxf = readFileSync(inchPath!, 'utf8')
  expect(inchDxf).toContain('$INSUNITS\n70\n1\n')

  const entitiesPart = inchDxf.split('\nENTITIES\n')[1] ?? ''
  expect(entitiesPart).not.toContain('\n8\nDUCT-EA\n')
  expect(entitiesPart).toContain('\n8\nDUCT-SA\n')

  // 5. Tutup dialog dan cek tidak ada overflow horizontal pada desktop maupun HP
  await page.getByTestId('export-finish-btn').click()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  expect(errors).toEqual([])
})
