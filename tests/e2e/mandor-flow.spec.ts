import { readFileSync, statSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

test('alur mandor lengkap (M5-05): proyek baru (mm, 1:100) -> ruangan 6x4 -> duct 3 titik -> diffuser -> warning ujung terbuka -> export DXF & PNG -> buka ulang dari .json', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  const isMobile = testInfo.project.name === 'hp'

  // 1. Buka /proyek -> buat proyek baru (mm, 1:100, ruangan awal 6x4 m)
  await page.goto('/proyek')
  await page.getByTestId('new-project-btn').click()
  await page.getByTestId('new-project-name').fill('Kantor Mandor')
  await page.getByTestId('new-unit-mm').check({ force: true })
  await page.getByTestId('new-project-scale').selectOption('1:100')
  await page.getByTestId('new-room-length').fill('6')
  await page.getByTestId('new-room-width').fill('4')
  await page.getByTestId('create-project-submit').click()

  await expect(page).toHaveURL(/\/editor\/[^/]+$/)
  const svg = page.locator('#cad')
  await expect(svg).toBeVisible()
  await expect(page.locator('#proj-name')).toHaveValue('Kantor Mandor')

  // Tutup kartu onboarding bila muncul agar kanvas bebas klik
  const hintClose = page.getByTestId('hint-close')
  if (await hintClose.isVisible()) {
    await hintClose.click()
  }

  // Pastikan ruangan awal 6x4 m (6000x4000) sudah tergambar di kanvas
  await expect(svg.locator('[data-layer="denah"] [data-id]')).toHaveCount(1)

  const box = (await svg.boundingBox())!

  // 2. Gambar ruangan 6x4 lewat alat Ruangan (K) + baris perintah 6x4 pada desktop
  if (!isMobile) {
    await page.keyboard.press('k')
    await page.mouse.click(box.x + box.width * 0.22, box.y + box.height * 0.25)
    const cmd = page.locator('#cmd')
    await cmd.click()
    await cmd.fill('6x4')
    await cmd.press('Enter')
    await expect(svg.locator('[data-layer="denah"] [data-id]')).toHaveCount(2)
  }

  // 3. Gambar jalur duct 3 titik (2 segmen lurus + 1 elbow otomatis)
  if (isMobile) {
    await page.locator('#rail').getByRole('button', { name: 'Alat', exact: true }).click()
    await page.getByTestId('tool-btn-duct').click()
  }
  else {
    await page.keyboard.press('d')
  }
  await expect(svg).toHaveAttribute('data-tool', 'duct')

  const p1x = box.x + box.width * 0.28
  const p1y = box.y + box.height * 0.42
  const p2x = box.x + box.width * 0.56
  const p2y = p1y
  const p3x = p2x
  const p3y = box.y + box.height * 0.65

  await page.mouse.click(p1x, p1y)
  await page.mouse.click(p2x, p2y)
  await page.mouse.click(p3x, p3y)
  await page.keyboard.press('Enter')

  // Minimal 3 komponen duct SA (lurus + elbow + lurus) terpasang
  await expect.poll(async () => svg.locator('[data-layer="sa"] [data-id]').count()).toBeGreaterThanOrEqual(3)

  // 4. Tempel diffuser dari Elemen ke kanvas
  const rail = page.locator('#rail')
  const elemenBtn = rail.getByRole('button', { name: 'Elemen', exact: true })
  const lib = page.getByTestId('workspace-lib')
  if (await lib.evaluate(el => el.classList.contains('is-hidden')) || !(await page.locator('[data-place="diffuser"]').isVisible())) {
    await elemenBtn.click()
  }
  await page.locator('[data-place="diffuser"]').click()
  await page.mouse.click(p3x, p3y)

  await expect(svg.locator('[data-layer="diff"] [data-id]')).toHaveCount(1)

  // 5. Lihat warning ujung terbuka muncul di kanvas dan status bar
  const openWarns = page.locator('[data-testid="warn-marker"][data-warn-kind="open"]')
  await expect.poll(async () => openWarns.count()).toBeGreaterThanOrEqual(1)
  await expect(page.getByTestId('warn-btn')).toContainText(/\d+ warning/)

  // 6. Export DXF R12
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(page.getByTestId('export-fmt-dxf')).toBeVisible()
  const dxfPromise = page.waitForEvent('download')
  await page.getByTestId('export-submit-btn').click()
  const dxfDownload = await dxfPromise
  expect(dxfDownload.suggestedFilename()).toBe('kantor-mandor.dxf')
  const dxfPath = await dxfDownload.path()
  const dxfContent = readFileSync(dxfPath!, 'utf8')
  expect(dxfContent).toContain('AC1009')
  expect(dxfContent).toContain('DUCT-SA')
  expect(dxfContent).toContain('DIFFUSER')
  expect(dxfContent.trimEnd().endsWith('EOF')).toBe(true)

  // 7. Export PNG
  await page.getByTestId('export-again-btn').click()
  await page.getByTestId('export-fmt-png').click()
  const pngPromise = page.waitForEvent('download')
  await page.getByTestId('export-submit-btn').click()
  const pngDownload = await pngPromise
  expect(pngDownload.suggestedFilename()).toBe('kantor-mandor.png')
  const pngPath = await pngDownload.path()
  expect(statSync(pngPath!).size).toBeGreaterThan(1000)
  expect(readFileSync(pngPath!).subarray(0, 8).equals(PNG_MAGIC)).toBe(true)

  // 8. Export .json lalu buka ulang dari halaman /proyek
  await page.getByTestId('export-again-btn').click()
  await page.getByTestId('export-fmt-json').click()
  const jsonPromise = page.waitForEvent('download')
  await page.getByTestId('export-submit-btn').click()
  const jsonDownload = await jsonPromise
  expect(jsonDownload.suggestedFilename()).toBe('kantor-mandor.json')
  const jsonPath = await jsonDownload.path()
  const jsonBytes = readFileSync(jsonPath!)

  await page.getByTestId('export-finish-btn').click()

  await page.getByRole('link', { name: 'Kembali ke proyek' }).click()
  await expect(page).toHaveURL(/\/proyek$/)

  await page.getByTestId('import-json-input').setInputFiles({
    name: 'kantor-mandor.json',
    mimeType: 'application/json',
    buffer: jsonBytes,
  })
  await expect(page).toHaveURL(/\/editor\/[^/]+$/)
  await expect(page.locator('#proj-name')).toHaveValue('Kantor Mandor')
  await expect.poll(async () => page.locator('#cad [data-layer="sa"] [data-id]').count()).toBeGreaterThanOrEqual(3)
  await expect(page.locator('#cad [data-layer="diff"] [data-id]')).toHaveCount(1)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  expect(errors).toEqual([])
})
