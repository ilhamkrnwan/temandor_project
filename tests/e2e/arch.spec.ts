import { expect, test, type Page } from '@playwright/test'

async function worldToClient(page: Page, wx: number, wy: number): Promise<{ x: number, y: number }> {
  return page.evaluate(({ x, y }) => {
    const el = document.querySelector('#cad') as SVGSVGElement
    const box = el.getBoundingClientRect()
    const [vx, vy, vw, vh] = (el.getAttribute('viewBox') || '0 0 1000 1000').split(/\s+/).map(Number)
    const scale = Math.min(box.width / vw!, box.height / vh!)
    const ox = (box.width - vw! * scale) / 2
    const oy = (box.height - vh! * scale) / 2
    return {
      x: box.left + ox + (x - vx!) * scale,
      y: box.top + oy + (y - vy!) * scale,
    }
  }, { x: wx, y: wy })
}

test('arsitektur: pintu menempel & memotong dinding ruangan, ikut ruangan bergeser, R/M, dan partisi berantai W', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  const isMobile = testInfo.project.name === 'hp'
  const freshId = `uji-arch-${Date.now()}`
  await page.goto(`/editor/${freshId}?baru=1`)

  const hintCard = page.getByTestId('onboarding-hint')
  await expect(hintCard).toBeVisible()
  await page.getByTestId('hint-close').click()
  await expect(hintCard).toHaveCount(0)

  const svg = page.locator('#cad')
  await expect(svg).toBeVisible()

  // Jumlah garis dinding Ruangan 1 sebelum ada pintu (1 ring + 8 segmen garis = 9 path)
  const roomPathsBefore = await page.locator('#world g[data-layer="denah"] > g[data-id] path').count()

  // 1. Pilih Pintu dari panel Elemen dan tempel ke dinding atas Ruangan 1 (y=75 mm, x=3000 mm)
  if (isMobile) {
    await page.locator('#rail').getByRole('button', { name: 'Elemen' }).click()
  }
  await page.locator('[data-place="door"]').click()
  await expect(svg).toHaveAttribute('data-tool', 'place')

  const wallTarget = await worldToClient(page, 3000, 75)
  await page.mouse.move(wallTarget.x, wallTarget.y)
  await expect(page.getByTestId('drag-ghost')).toBeVisible()
  await page.mouse.click(wallTarget.x, wallTarget.y)
  await page.keyboard.press('Escape')

  const doors = page.locator('#world g[data-layer="bukaan"] > g[data-id]')
  await expect(doors).toHaveCount(1)

  // Dinding ruangan terpotong oleh pintu -> jumlah garis dinding bertambah (tiap sisi terbelah 2)
  const roomPathsAfter = await page.locator('#world g[data-layer="denah"] > g[data-id] path').count()
  expect(roomPathsAfter).toBeGreaterThan(roomPathsBefore)

  // 2. Pilih pintu lewat Tab (Tab 1 = Ruangan 1, Tab 2 = Pintu) -> tombol Engsel, Arah buka, Lepas muncul
  await svg.focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('door-hinge-btn')).toBeVisible()
  await expect(page.getByTestId('door-swing-btn')).toBeVisible()
  await expect(page.getByTestId('opening-detach-btn')).toBeVisible()

  // Uji R (arah buka) & M (engsel) langsung mengubah geometri daun pintu
  const beforeSwingPath = await doors.first().innerHTML()
  await page.keyboard.press('r')
  const afterSwingPath = await doors.first().innerHTML()
  expect(afterSwingPath).not.toBe(beforeSwingPath)

  await page.keyboard.press('m')
  const afterHingePath = await doors.first().innerHTML()
  expect(afterHingePath).not.toBe(afterSwingPath)

  // 3. Pindah ke Ruangan 1 (Shift+Tab) lalu geser ruangan +100 mm (Shift+ArrowRight) -> pintu ikut bergeser +100 mm
  const doorXBefore = await doors.first().evaluate(el => (el as SVGGElement).getBBox().x)
  await svg.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Shift+ArrowRight')
  const doorXAfter = await doors.first().evaluate(el => (el as SVGGElement).getBBox().x)
  expect(doorXAfter - doorXBefore).toBeCloseTo(100, 0)

  // 4. Partisi berantai lewat alat 'W' (ketik panjang 2000 + Enter -> segmen 1 + titik rantai aktif, klik segmen 2)
  const denahCountBefore = await page.locator('#world g[data-layer="denah"] > g[data-id]').count()
  await page.keyboard.press('w')
  await expect(svg).toHaveAttribute('data-tool', 'wall')

  const w0 = await worldToClient(page, 1500, 2000)
  const wRight = await worldToClient(page, 4000, 2000)
  const wDown = await worldToClient(page, 3500, 3500)

  await page.mouse.click(w0.x, w0.y)
  await expect(page.getByTestId('draw-point')).toHaveCount(1)
  await page.mouse.move(wRight.x, wRight.y)
  await page.keyboard.type('2000')
  await page.keyboard.press('Enter')

  // Partisi 1 dibuat dan berantai (masih 1 titik aktif di ujungnya)
  await expect(page.locator('#world g[data-layer="denah"] > g[data-id]')).toHaveCount(denahCountBefore + 1)
  await expect(page.getByTestId('draw-point')).toHaveCount(1)

  // Klik tegak lurus ke bawah -> partisi 2 tersambung
  await page.mouse.move(wDown.x, wDown.y)
  await page.mouse.click(wDown.x, wDown.y)
  await expect(page.locator('#world g[data-layer="denah"] > g[data-id]')).toHaveCount(denahCountBefore + 2)

  // Esc mengakhiri rantai partisi; Ctrl+Z menghapus partisi ke-2
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('draw-point')).toHaveCount(0)
  await page.keyboard.press('Control+z')
  await expect(page.locator('#world g[data-layer="denah"] > g[data-id]')).toHaveCount(denahCountBefore + 1)

  // Tidak ada overflow horizontal pada desktop maupun HP
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  expect(errors).toEqual([])
})
