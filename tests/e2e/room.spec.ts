import { expect, test, type Page } from '@playwright/test'

async function countRooms(page: Page): Promise<number> {
  return page.locator('#world g[data-layer="denah"] > g[data-id]').count()
}

test('ruangan (K/REC 6x4, bentuk L/T/U, tambah titik klik ganda grip, ganti nama klik ganda, dan ruangan bebas P/PL)', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  const freshId = `uji-room-${Date.now()}`
  await page.goto(`/editor/${freshId}?baru=1`)

  const hintCard = page.getByTestId('onboarding-hint')
  await expect(hintCard).toBeVisible()
  await page.getByTestId('hint-close').click()
  await expect(hintCard).toHaveCount(0)

  const svg = page.locator('#cad')
  await expect(svg).toBeVisible()
  const box = (await svg.boundingBox())!

  // Awal proyek baru memiliki 1 ruangan (Ruangan 1)
  expect(await countRooms(page)).toBe(1)

  // 1. Buat ruangan 6x4 (6000 x 4000 mm) dengan pintasan K + klik sudut 1 + ketik '6x4' + Enter
  await svg.focus()
  await page.keyboard.press('k')
  await expect(svg).toHaveAttribute('data-tool', 'room')

  const p0x = Math.round(box.x + box.width * 0.22)
  const p0y = Math.round(box.y + box.height * 0.25)
  const p1x = Math.round(box.x + box.width * 0.58)
  const p1y = Math.round(box.y + box.height * 0.58)

  await page.mouse.move(p0x, p0y)
  await page.mouse.click(p0x, p0y)
  await expect(page.getByTestId('draw-point')).toHaveCount(1)

  await page.mouse.move(p1x, p1y)
  await expect(page.getByTestId('cursor-measure')).toContainText('mm')

  await page.keyboard.type('6x4')
  await expect(page.getByRole('textbox', { name: 'Baris perintah' })).toHaveValue('6x4')
  await page.keyboard.press('Enter')

  expect(await countRooms(page)).toBe(2)
  await expect(page.locator('#world')).toContainText('RUANGAN 2')
  await expect(page.locator('#world')).toContainText('21.1 m²')

  // Undo 1 langkah menghapus Ruangan 2, Redo mengembalikannya
  await page.keyboard.press('Control+z')
  expect(await countRooms(page)).toBe(1)
  await page.keyboard.press('Control+y')
  expect(await countRooms(page)).toBe(2)

  // 2. Kembali ke Pilih (Esc), pilih Ruangan 1 lewat Tab -> ubah bentuk ke Bentuk L lewat toolbar Bentuk
  await page.keyboard.press('Escape')
  await expect(svg).toHaveAttribute('data-tool', 'select')
  await svg.focus()
  await page.keyboard.press('Tab')

  await expect(page.getByTestId('room-shape-btn')).toBeVisible()
  await expect(page.locator('#overlay [data-grip^="v"]')).toHaveCount(4)

  await page.getByTestId('room-shape-btn').click()
  await page.getByRole('menuitem', { name: 'Bentuk L' }).click()
  await expect(page.locator('#overlay [data-grip^="v"]')).toHaveCount(6)
  await expect(page.locator('#overlay [data-grip^="e"]')).toHaveCount(6)

  // 3. Klik ganda grip sisi e0 menambah 1 titik sudut (6 -> 7 titik), lalu undo kembali ke 6 titik
  const edgeGrip = page.locator('#overlay [data-grip="e0"]')
  const egBox = (await edgeGrip.boundingBox())!
  await page.mouse.click(egBox.x + egBox.width / 2, egBox.y + egBox.height / 2)
  await page.mouse.click(egBox.x + egBox.width / 2, egBox.y + egBox.height / 2)
  await expect(page.locator('#overlay [data-grip^="v"]')).toHaveCount(7)

  await page.keyboard.press('Control+z')
  await expect(page.locator('#overlay [data-grip^="v"]')).toHaveCount(6)

  // 4. Klik ganda label/dinding ruangan untuk ganti nama langsung di kanvas -> "Lobby Utama"
  const roomLabel = page.locator('#world g[data-layer="denah"] text', { hasText: 'RUANGAN 1' }).first()
  const rBox = (await roomLabel.boundingBox())!
  await page.mouse.dblclick(rBox.x + rBox.width / 2, rBox.y + rBox.height / 2)

  const inlineInput = page.getByTestId('inline-edit')
  await expect(inlineInput).toBeVisible()
  await inlineInput.fill('Lobby Utama')
  await inlineInput.press('Enter')
  await expect(inlineInput).toHaveCount(0)
  await expect(page.locator('#world')).toContainText('LOBBY UTAMA')

  // 5. Buat ruangan bebas poligon lewat 'P' (klik 4 sudut + Enter -> Ruangan 3)
  await svg.focus()
  await page.keyboard.press('p')
  await expect(svg).toHaveAttribute('data-tool', 'poly')

  const q0x = Math.round(box.x + box.width * 0.3)
  const q0y = Math.round(box.y + box.height * 0.25)
  const q1x = Math.round(box.x + box.width * 0.7)
  const q2y = Math.round(box.y + box.height * 0.65)

  await page.mouse.click(q0x, q0y)
  await page.mouse.move(q1x, q0y)
  await page.mouse.click(q1x, q0y)
  await page.mouse.move(q1x, q2y)
  await page.mouse.click(q1x, q2y)
  await page.mouse.move(q0x, q2y)
  await page.mouse.click(q0x, q2y)
  await expect(page.getByTestId('draw-point')).toHaveCount(4)

  await page.keyboard.press('Enter')
  await expect(page.getByTestId('draw-point')).toHaveCount(0)
  expect(await countRooms(page)).toBe(3)
  await expect(page.locator('#world g[data-layer="denah"] text', { hasText: 'm²' })).toHaveCount(3)

  // Undo 1 langkah menghapus ruangan poligon bebas
  await page.keyboard.press('Control+z')
  expect(await countRooms(page)).toBe(2)

  // Tidak ada overflow horizontal pada desktop maupun HP
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  expect(errors).toEqual([])
})
