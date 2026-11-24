import { expect, test, type Page } from '@playwright/test'

async function countLayerNodes(page: Page, layer: string): Promise<number> {
  return page.locator(`#world g[data-layer="${layer}"] > g[data-id]`).count()
}

test('alat gambar duct (D/L): klik titik, elbow otomatis, ketik angka panjang, Backspace, Enter/klik kanan, dan 1 langkah undo', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  const freshId = `uji-duct-${Date.now()}`
  await page.goto(`/editor/${freshId}?baru=1`)

  // Tunggu proyek baru selesai dimuat (kartu onboarding muncul), lalu tutup agar kanvas bebas klik
  const hintCard = page.getByTestId('onboarding-hint')
  await expect(hintCard).toBeVisible()
  await page.getByTestId('hint-close').click()
  await expect(hintCard).toHaveCount(0)

  const svg = page.locator('#cad')
  await expect(svg).toBeVisible()
  const box = (await svg.boundingBox())!

  // Awalnya proyek baru hanya berisi 1 ruangan, 0 node di layer SA
  expect(await countLayerNodes(page, 'sa')).toBe(0)

  // 1. Aktifkan alat duct via pintasan 'D'
  await svg.focus()
  await page.keyboard.press('d')
  await expect(svg).toHaveAttribute('data-tool', 'duct')

  // 2. Klik titik awal, arahkan ke kanan, ketik panjang tepat 3000 + Enter
  const p0x = Math.round(box.x + box.width * 0.25)
  const p0y = Math.round(box.y + box.height * 0.35)
  const rightX = Math.round(box.x + box.width * 0.65)
  const downY = Math.round(box.y + box.height * 0.7)

  await page.mouse.move(p0x, p0y)
  await page.mouse.click(p0x, p0y)
  await expect(page.getByTestId('draw-point')).toHaveCount(1)

  // Gerakkan kursor ke kanan agar arah segmen 0°, lalu ketik angka 3000 + Enter langsung di kanvas
  await page.mouse.move(rightX, p0y)
  await expect(page.getByTestId('drag-ghost')).toBeVisible()
  await expect(page.getByTestId('cursor-measure')).toContainText('mm')

  await page.keyboard.type('3000')
  await expect(page.getByRole('textbox', { name: 'Baris perintah' })).toHaveValue('3000')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('draw-point')).toHaveCount(2)

  // 3. Klik titik tambahan lalu uji Backspace menghapus titik terakhir
  await page.mouse.move(rightX, downY)
  await page.mouse.click(rightX, downY)
  await expect(page.getByTestId('draw-point')).toHaveCount(3)

  await page.keyboard.press('Backspace')
  await expect(page.getByTestId('draw-point')).toHaveCount(2)

  // 4. Ketik panjang 2000 ke arah bawah (90° turn -> elbow otomatis), lalu tekan Enter untuk selesai
  await page.mouse.move(rightX, downY)
  await page.keyboard.type('2000')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('draw-point')).toHaveCount(3)

  await page.keyboard.press('Enter')
  await expect(page.getByTestId('draw-point')).toHaveCount(0)

  // Jalur 3 titik -> 2 straight + 1 elbow = 3 node pada layer SA
  expect(await countLayerNodes(page, 'sa')).toBe(3)

  // 5. Satu jalur = tepat satu langkah undo (Ctrl+Z hapus ketiga node sekaligus; Ctrl+Y kembalikan)
  await page.keyboard.press('Control+z')
  expect(await countLayerNodes(page, 'sa')).toBe(0)

  await page.keyboard.press('Control+y')
  expect(await countLayerNodes(page, 'sa')).toBe(3)

  // 6. Uji klik kanan menyelesaikan jalur duct (tanpa membuka menu klik kanan) dan matikan ORTHO (F8) untuk belokan bebas
  await page.keyboard.press('F8')
  const b0x = Math.round(box.x + box.width * 0.25)
  const b0y = Math.round(box.y + box.height * 0.65)
  const b1x = Math.round(box.x + box.width * 0.5)
  const b2x = Math.round(box.x + box.width * 0.68)
  const b2y = Math.round(box.y + box.height * 0.45)

  await page.mouse.move(b0x, b0y)
  await page.mouse.click(b0x, b0y)
  await page.mouse.move(b1x, b0y)
  await page.mouse.click(b1x, b0y)
  await page.mouse.move(b2x, b2y)
  await page.mouse.click(b2x, b2y)
  await expect(page.getByTestId('draw-point')).toHaveCount(3)

  await page.mouse.click(b2x, b2y, { button: 'right' })
  await expect(page.getByTestId('draw-point')).toHaveCount(0)
  await expect(page.getByRole('menu')).toHaveCount(0)
  expect(await countLayerNodes(page, 'sa')).toBe(6)

  // Satu undo menghapus jalur kedua (kembali ke 3 node)
  await page.keyboard.press('Control+z')
  expect(await countLayerNodes(page, 'sa')).toBe(3)

  // Tidak ada overflow horizontal pada desktop maupun HP
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  expect(errors).toEqual([])
})
