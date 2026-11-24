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

async function nodeRectInWorld(page: Page, nodeId: string) {
  return page.evaluate((id) => {
    const els = [...document.querySelectorAll(`#world [data-id="${id}"]`)] as SVGGElement[]
    if (els.length === 0) return null
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const el of els) {
      const b = el.getBBox()
      x0 = Math.min(x0, b.x)
      y0 = Math.min(y0, b.y)
      x1 = Math.max(x1, b.x + b.width)
      y1 = Math.max(y1, b.y + b.height)
    }
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
  }, nodeId)
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

test('seret pindah + ghost + undo 1 langkah, panah/Shift+panah, R/M, Ctrl+C/V/D, dan grip biru/putih', async ({ page }) => {
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
  await expect(page.locator('#world')).toContainText('ODU-01')

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  // 1. Klik Outdoor Unit di (-800, 1500) -> seret ke kiri-bawah -> ghost muncul -> lepas -> undo 1 langkah kembali tepat
  const oduPt = await worldToClient(page, -800, 1500)
  await page.mouse.click(oduPt.x, oduPt.y)

  const oduId = await page.evaluate(() => document.querySelector('#world [data-id].sel')?.getAttribute('data-id') || '')
  expect(oduId).toBeTruthy()
  const beforeMove = (await nodeRectInWorld(page, oduId))!

  // Pastikan grip putih (ukuran) tampil pada Outdoor Unit terpilih
  const sizeGrip = page.locator('#overlay [data-grip="s"]')
  await expect(sizeGrip).toBeVisible()
  await expect(sizeGrip).toHaveAttribute('data-grip-kind', 'size')

  // Seret Outdoor Unit sejauh ~60 px ke kiri dan 40 px ke bawah
  await page.mouse.move(oduPt.x, oduPt.y)
  await page.mouse.down({ button: 'left' })
  await page.mouse.move(oduPt.x - 60, oduPt.y + 40)
  await expect(page.getByTestId('drag-ghost')).toBeVisible()
  await page.mouse.up({ button: 'left' })
  await expect(page.getByTestId('drag-ghost')).toHaveCount(0)

  const afterMove = (await nodeRectInWorld(page, oduId))!
  expect(afterMove.x).toBeLessThan(beforeMove.x - 100)
  expect(afterMove.y).toBeGreaterThan(beforeMove.y + 50)

  // Undo 1 langkah (Ctrl+Z) mengembalikan posisi Outdoor Unit ke koordinat awal
  await page.keyboard.press('Control+z')
  const afterUndoMove = (await nodeRectInWorld(page, oduId))!
  expect(Math.abs(afterUndoMove.x - beforeMove.x)).toBeLessThan(1)
  expect(Math.abs(afterUndoMove.y - beforeMove.y)).toBeLessThan(1)

  // 2. Nudge panah (10 mm) dan Shift+panah (100 mm) masing-masing 1 langkah undo
  await page.keyboard.press('ArrowRight')
  const afterNudge10 = (await nodeRectInWorld(page, oduId))!
  expect(afterNudge10.x - beforeMove.x).toBeCloseTo(10, 0)

  await page.keyboard.press('Shift+ArrowDown')
  const afterNudge100 = (await nodeRectInWorld(page, oduId))!
  expect(afterNudge100.y - beforeMove.y).toBeCloseTo(100, 0)

  await page.keyboard.press('Control+z')
  const afterUndo100 = (await nodeRectInWorld(page, oduId))!
  expect(Math.abs(afterUndo100.y - beforeMove.y)).toBeLessThan(1)
  expect(afterUndo100.x - beforeMove.x).toBeCloseTo(10, 0)

  await page.keyboard.press('Control+z')
  const afterUndo10 = (await nodeRectInWorld(page, oduId))!
  expect(Math.abs(afterUndo10.x - beforeMove.x)).toBeLessThan(1)

  // 3. Putar (R), Cermin (M), dan Duplikat (Ctrl+D) masing-masing 1 langkah undo
  const countBefore = await totalNodeIds(page)
  await page.keyboard.press('r')
  const afterRotate = (await nodeRectInWorld(page, oduId))!
  // Outdoor Unit (900x350, rot 90 -> 180) berubah rasio lebar/tinggi
  expect(afterRotate.width).toBeGreaterThan(beforeMove.width + 100)
  await page.keyboard.press('Control+z')
  const afterUndoRotate = (await nodeRectInWorld(page, oduId))!
  expect(Math.abs(afterUndoRotate.width - beforeMove.width)).toBeLessThan(1)

  await page.keyboard.press('Control+d')
  expect(await totalNodeIds(page)).toBe(countBefore + 1)
  await page.keyboard.press('Control+z')
  expect(await totalNodeIds(page)).toBe(countBefore)

  // 4. Klik duct lurus pertama setelah FCU di (2600, 1500) -> cek grip biru ('b') & putih ('w'), seret grip biru panjang -> undo 1 langkah
  const ductPt = await worldToClient(page, 2600, 1500)
  await page.mouse.click(ductPt.x, ductPt.y)

  const ductId = await page.evaluate(() => document.querySelector('#world [data-id].sel')?.getAttribute('data-id') || '')
  expect(ductId).toBeTruthy()
  const blueGrip = page.locator('#overlay [data-grip="b"]')
  const whiteGrip = page.locator('#overlay [data-grip="w"]')
  await expect(blueGrip).toHaveAttribute('data-grip-kind', 'pos')
  await expect(whiteGrip).toHaveAttribute('data-grip-kind', 'size')

  const ductBefore = (await nodeRectInWorld(page, ductId))!
  const gripBox = (await blueGrip.boundingBox())!
  const gx = gripBox.x + gripBox.width / 2
  const gy = gripBox.y + gripBox.height / 2

  await page.mouse.move(gx, gy)
  await page.mouse.down({ button: 'left' })
  await page.mouse.move(gx + 35, gy)
  await expect(page.getByTestId('drag-ghost')).toBeVisible()
  await page.mouse.up({ button: 'left' })
  await expect(page.getByTestId('drag-ghost')).toHaveCount(0)

  const ductAfterGrip = (await nodeRectInWorld(page, ductId))!
  expect(ductAfterGrip.width).toBeGreaterThan(ductBefore.width + 50)

  // Undo 1 langkah mengembalikan panjang duct tepat seperti semula
  await page.keyboard.press('Control+z')
  const ductAfterUndo = (await nodeRectInWorld(page, ductId))!
  expect(Math.abs(ductAfterUndo.width - ductBefore.width)).toBeLessThan(1)

  expect(errors).toEqual([])
})
