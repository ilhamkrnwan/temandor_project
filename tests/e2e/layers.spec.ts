import { expect, test } from '@playwright/test'

test('panel layer: tampil/sembunyi & kunci per layer, layer tersembunyi tidak bisa dipilih, dan status layer tersimpan setelah reload', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  const isMobile = testInfo.project.name === 'hp'

  await page.goto('/editor/contoh')

  const svg = page.locator('#cad')
  await expect(svg).toBeVisible()

  // Buka panel Layer dari rail
  await page.locator('#rail').getByRole('button', { name: 'Layer' }).click()
  const lib = page.getByTestId('workspace-lib')
  await expect(lib).toBeVisible()

  // Semua 11 layer DXF tampil
  for (const dxf of ['DUCT-SA', 'DUCT-EA', 'EQUIPMENT', 'DIFFUSER', 'HANGER', 'DIMENSION', 'A-WALL', 'A-COLS', 'A-DOOR', 'A-MISC', 'MARKUP']) {
    await expect(lib).toContainText(dxf)
  }

  // Sebelum disembunyikan, layer SA memiliki node di #world
  const saLayerNodes = page.locator('#world g[data-layer="sa"] > g[data-id]')
  const saCountBefore = await saLayerNodes.count()
  expect(saCountBefore).toBeGreaterThan(0)

  // 1. Sembunyikan layer Supply Air (SA)
  const saToggle = page.getByTestId('layer-toggle-sa')
  await expect(saToggle).toBeChecked()
  await saToggle.uncheck()
  await expect(saToggle).not.toBeChecked()
  await expect(saLayerNodes).toHaveCount(0)

  // 2. Kunci layer Equipment (eq)
  const eqLock = page.getByTestId('layer-lock-eq')
  await expect(eqLock).toHaveAttribute('aria-pressed', 'false')
  await eqLock.click()
  await expect(eqLock).toHaveAttribute('aria-pressed', 'true')

  // Tunggu autosave menyimpan status layer ke IndexedDB
  await expect(page.getByTestId('save-status')).toContainText('Tersimpan ')

  // Tutup sheet pada HP agar bisa klik/pilih di kanvas
  if (isMobile) {
    await lib.getByRole('button', { name: 'Tutup panel' }).click()
  }

  // Layer SA tersembunyi & Equipment terkunci tidak masuk seleksi Ctrl+A
  await svg.focus()
  await page.keyboard.press('Control+a')
  const selectedLayers = await page.evaluate(() => {
    const layers = new Set<string>()
    document.querySelectorAll('#world g[data-layer]').forEach((layerEl) => {
      if (layerEl.querySelector('[data-id].sel')) {
        layers.add(layerEl.getAttribute('data-layer') || '')
      }
    })
    return [...layers]
  })
  expect(selectedLayers).not.toContain('sa')
  expect(selectedLayers).not.toContain('eq')

  // Klik komponen pada layer Equipment yang terkunci tidak memilihnya
  await page.keyboard.press('Escape')
  const fcuBox = (await page.locator('#world g[data-layer="eq"] > g[data-id]').first().boundingBox())!
  await page.mouse.click(fcuBox.x + fcuBox.width / 2, fcuBox.y + fcuBox.height / 2)
  await expect(page.getByTestId('selection-count')).toHaveCount(0)

  // 3. Muat ulang halaman -> status layer tersembunyi & terkunci tetap tersimpan di proyek
  await page.reload()
  await expect(svg).toBeVisible()
  await expect(saLayerNodes).toHaveCount(0)

  if (isMobile) {
    await page.locator('#rail').getByRole('button', { name: 'Layer' }).click()
  }
  await expect(page.getByTestId('layer-toggle-sa')).not.toBeChecked()
  await expect(page.getByTestId('layer-lock-eq')).toHaveAttribute('aria-pressed', 'true')

  // Tampilkan kembali layer SA dan buka kunci Equipment
  await page.getByTestId('layer-toggle-sa').check()
  await expect(saLayerNodes).toHaveCount(saCountBefore)
  await page.getByTestId('layer-lock-eq').click()
  await expect(page.getByTestId('layer-lock-eq')).toHaveAttribute('aria-pressed', 'false')

  // Tidak ada overflow horizontal pada desktop maupun HP
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  expect(errors).toEqual([])
})
