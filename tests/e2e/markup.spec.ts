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

test('ukur 3 klik (U), menu Teks + ketik langsung di kanvas + gaya, catatan + panah (seret titik biru), dan coretan tangan (B)', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  const isMobile = testInfo.project.name === 'hp'

  const freshId = `uji-markup-${Date.now()}`
  await page.goto(`/editor/${freshId}?baru=1`)

  const hintCard = page.getByTestId('onboarding-hint')
  await expect(hintCard).toBeVisible()
  await page.getByTestId('hint-close').click()
  await expect(hintCard).toHaveCount(0)

  const svg = page.locator('#cad')
  await expect(svg).toBeVisible()

  // 1. Menu Teks -> Tambah judul -> langsung ketik di kanvas -> uji gaya (Miring, Kotak, Warna Merah)
  await page.locator('#rail').getByRole('button', { name: 'Teks' }).click()
  await page.getByTestId('text-preset-heading').click()

  const inlineInput = page.getByTestId('inline-edit')
  await expect(inlineInput).toBeVisible()
  await inlineInput.fill('Area Lantai 2')
  await inlineInput.press('Enter')
  await expect(inlineInput).toHaveCount(0)
  await expect(page.locator('#world')).toContainText('Area Lantai 2')

  // Toolbar gaya teks tampil saat teks terpilih
  await expect(page.getByTestId('text-flag-b')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('text-flag-it').click()
  await expect(page.getByTestId('text-flag-it')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('text-flag-bx').click()
  await expect(page.getByTestId('text-flag-bx')).toHaveAttribute('aria-pressed', 'true')

  // 2. Catatan + panah -> klik kanvas -> seret titik biru [data-grip="t"] memindah teks
  if (isMobile) {
    await page.locator('#rail').getByRole('button', { name: 'Teks' }).click()
  }
  await page.getByTestId('text-preset-note').click()
  await expect(svg).toHaveAttribute('data-tool', 'place')

  const noteTip = await worldToClient(page, 2000, 2000)
  await page.mouse.move(noteTip.x, noteTip.y)
  await page.mouse.click(noteTip.x, noteTip.y)
  await expect(svg).toHaveAttribute('data-tool', 'select')
  await expect(page.locator('#world')).toContainText('Cek di lapangan')

  const noteGrip = page.locator('#overlay [data-grip="t"]')
  await expect(noteGrip).toBeVisible()
  const gBox = (await noteGrip.boundingBox())!
  await page.mouse.move(gBox.x + gBox.width / 2, gBox.y + gBox.height / 2)
  await page.mouse.down({ button: 'left' })
  await page.mouse.move(gBox.x + gBox.width / 2 + 45, gBox.y + gBox.height / 2 - 30)
  await page.mouse.up({ button: 'left' })
  const gBoxAfter = (await noteGrip.boundingBox())!
  expect(gBoxAfter.x).toBeGreaterThan(gBox.x + 20)

  // 3. Ukur / dimensi (U) tiga klik: (1000, 1000) -> (4000, 1000) -> offset atas -> tampil panjang tepat "3000"
  const dimCountBefore = await page.locator('#world g[data-layer="dim"] > g[data-id]').count()
  await svg.focus()
  await page.keyboard.press('u')
  await expect(svg).toHaveAttribute('data-tool', 'dim')

  const d1 = await worldToClient(page, 1000, 1000)
  const d2 = await worldToClient(page, 4000, 1000)
  const d3 = await worldToClient(page, 2500, 500)

  await page.mouse.click(d1.x, d1.y)
  await expect(page.getByTestId('draw-point')).toHaveCount(1)
  await page.mouse.move(d2.x, d2.y)
  await page.mouse.click(d2.x, d2.y)
  await expect(page.getByTestId('draw-point')).toHaveCount(2)
  await page.mouse.move(d3.x, d3.y)
  await page.mouse.click(d3.x, d3.y)
  await expect(page.getByTestId('draw-point')).toHaveCount(0)

  await expect(page.locator('#world g[data-layer="dim"] > g[data-id]')).toHaveCount(dimCountBefore + 1)
  await expect(page.locator('#world g[data-layer="dim"]')).toContainText('3000')

  // 4. Coretan tangan (B) di layer coret (MARKUP) + undo
  expect(await page.locator('#world g[data-layer="coret"] > g[data-id]').count()).toBe(0)
  await svg.focus()
  await page.keyboard.press('b')
  await expect(svg).toHaveAttribute('data-tool', 'pen')

  const s0 = await worldToClient(page, 1200, 2600)
  const s1 = await worldToClient(page, 2600, 2900)
  const s2 = await worldToClient(page, 3800, 2500)

  await page.mouse.move(s0.x, s0.y)
  await page.mouse.down({ button: 'left' })
  await page.mouse.move(s1.x, s1.y)
  await expect(page.getByTestId('pen-stroke')).toBeVisible()
  await page.mouse.move(s2.x, s2.y)
  await page.mouse.up({ button: 'left' })

  await expect(page.locator('#world g[data-layer="coret"] > g[data-id]')).toHaveCount(1)
  await page.keyboard.press('Control+z')
  await expect(page.locator('#world g[data-layer="coret"] > g[data-id]')).toHaveCount(0)

  // Tidak ada overflow horizontal pada desktop maupun HP
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  expect(errors).toEqual([])
})
