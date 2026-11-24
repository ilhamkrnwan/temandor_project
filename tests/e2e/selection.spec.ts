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

async function selectedNodeIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const ids = new Set<string>()
    document.querySelectorAll('#world [data-id].sel').forEach((el) => {
      const id = el.getAttribute('data-id')
      if (id) ids.add(id)
    })
    return [...ids]
  })
}

async function totalNodeIds(page: Page): Promise<number> {
  return page.evaluate(() => {
    const ids = new Set<string>()
    document.querySelectorAll('#world [data-id]').forEach((el) => {
      const id = el.getAttribute('data-id')
      if (id) ids.add(id)
    })
    return ids.size
  })
}

test('seleksi klik, Shift+klik, tarik kotak window vs crossing, dan seleksi keyboard Tab + Delete + Urungkan', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  await page.goto('/editor/contoh')

  const svg = page.locator('#cad')
  await expect(svg).toBeVisible()
  await expect(page.locator('#world')).toContainText('FCU-01 · 1300 cfm')

  // Tidak ada overflow horizontal pada desktop maupun HP
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  // 1. Window drag (kiri -> kanan) hanya melingkupi Outdoor Unit di (-800, 1500) tanpa melingkupi ruangan Kantor
  const winStart = await worldToClient(page, -1500, 500)
  const winEnd = await worldToClient(page, -100, 2800)
  await page.mouse.move(winStart.x, winStart.y)
  await page.mouse.down({ button: 'left' })
  await page.mouse.move(winEnd.x, winEnd.y)
  await expect(page.getByTestId('selection-box')).toHaveAttribute('data-box-mode', 'window')
  await page.mouse.up({ button: 'left' })

  const winIds = await selectedNodeIds(page)
  expect(winIds).toHaveLength(1)
  await expect(page.getByTestId('selection-count')).toHaveText('1 dipilih')

  // 2. Crossing drag (kanan -> kiri) melintasi area yang menyentuh Outdoor Unit DAN dinding kiri ruangan Kantor (x = 0)
  const crossStart = await worldToClient(page, 200, 2300)
  const crossEnd = await worldToClient(page, -600, 1100)
  await page.mouse.move(crossStart.x, crossStart.y)
  await page.mouse.down({ button: 'left' })
  await page.mouse.move(crossEnd.x, crossEnd.y)
  await expect(page.getByTestId('selection-box')).toHaveAttribute('data-box-mode', 'crossing')
  await page.mouse.up({ button: 'left' })

  const crossIds = await selectedNodeIds(page)
  expect(crossIds.length).toBeGreaterThanOrEqual(2)
  await expect(page.getByTestId('selection-frame')).toBeVisible()

  // 3. Klik area kosong membatalkan seleksi
  const emptyPt = await worldToClient(page, -1700, -900)
  await page.mouse.click(emptyPt.x, emptyPt.y)
  expect(await selectedNodeIds(page)).toHaveLength(0)

  // 4. Klik langsung pada Outdoor Unit lalu Shift+klik pada FCU-01 -> 2 komponen terpilih
  const outdoorPt = await worldToClient(page, -800, 1500)
  const fcuPt = await worldToClient(page, 1400, 1500)
  await page.mouse.click(outdoorPt.x, outdoorPt.y)
  expect(await selectedNodeIds(page)).toHaveLength(1)

  await page.keyboard.down('Shift')
  await page.mouse.click(fcuPt.x, fcuPt.y)
  await page.keyboard.up('Shift')
  expect(await selectedNodeIds(page)).toHaveLength(2)

  // Escape membatalkan seleksi
  await page.keyboard.press('Escape')
  expect(await selectedNodeIds(page)).toHaveLength(0)

  // 5. Seleksi keyboard: fokus kanvas -> Tab 2x -> Shift+Tab 1x -> Delete -> toast "Urungkan" -> klik Urungkan
  const countBefore = await totalNodeIds(page)
  await svg.focus()
  await page.keyboard.press('Tab')
  const firstTabIds = await selectedNodeIds(page)
  expect(firstTabIds).toHaveLength(1)
  await expect(page.getByTestId('sr-announce')).toContainText('dipilih, 1 dari')

  await page.keyboard.press('Tab')
  const secondTabIds = await selectedNodeIds(page)
  expect(secondTabIds).toHaveLength(1)
  expect(secondTabIds[0]).not.toBe(firstTabIds[0])
  await expect(page.getByTestId('sr-announce')).toContainText('dipilih, 2 dari')

  await page.keyboard.press('Shift+Tab')
  expect(await selectedNodeIds(page)).toEqual(firstTabIds)

  // Hapus dengan Delete -> muncul toast dengan tombol "Urungkan"
  await page.keyboard.press('Delete')
  expect(await totalNodeIds(page)).toBe(countBefore - 1)

  const undoToastBtn = page.getByRole('button', { name: 'Urungkan', exact: true }).last()
  await expect(page.getByText('1 komponen dihapus', { exact: true })).toBeVisible()
  await undoToastBtn.click()
  expect(await totalNodeIds(page)).toBe(countBefore)

  expect(errors).toEqual([])
})
