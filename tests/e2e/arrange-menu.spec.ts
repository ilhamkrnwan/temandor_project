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

test('group + klik ganda isi group, rata via dropdown keyboard, kunci, urutan, dan menu klik kanan + undo', async ({ page }) => {
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

  // 1. Pilih Outdoor (-800, 1500) + Shift+klik FCU (1400, 1500) -> toolbar melayang muncul -> klik Group
  const oduPt = await worldToClient(page, -800, 1500)
  const fcuPt = await worldToClient(page, 1400, 1500)
  await page.mouse.click(oduPt.x, oduPt.y)
  const [oduId] = await selectedNodeIds(page)
  expect(oduId).toBeTruthy()

  await page.keyboard.down('Shift')
  await page.mouse.click(fcuPt.x, fcuPt.y)
  await page.keyboard.up('Shift')
  expect(await selectedNodeIds(page)).toHaveLength(2)

  const toolbar = page.getByTestId('selection-toolbar')
  await expect(toolbar).toBeVisible()
  await toolbar.getByRole('button', { name: 'Group', exact: true }).click()
  await expect(toolbar.getByRole('button', { name: 'Ungroup', exact: true })).toBeVisible()

  // Batal pilih lalu klik satu anggota (ODU) -> seluruh group (2 komponen) ikut terpilih
  await page.keyboard.press('Escape')
  expect(await selectedNodeIds(page)).toHaveLength(0)

  await page.mouse.click(oduPt.x, oduPt.y)
  expect(await selectedNodeIds(page)).toHaveLength(2)

  // Klik ganda pada ODU -> masuk ke dalam group, hanya ODU yang terpilih
  await page.mouse.dblclick(oduPt.x, oduPt.y)
  expect(await selectedNodeIds(page)).toEqual([oduId])

  // Undo Group -> kembali tidak ter-group
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Escape')
  await page.mouse.click(oduPt.x, oduPt.y)
  expect(await selectedNodeIds(page)).toEqual([oduId])

  // 2. Pilih ODU + FCU lagi -> buka dropdown "Rata" dan jalankan "Rata kiri" memakai keyboard -> lalu Undo
  const fcuBefore = await page.evaluate((omitId) => {
    const g = [...document.querySelectorAll('#world g[data-layer="eq"] [data-id]')]
      .find(el => el.getAttribute('data-id') !== omitId && el.textContent?.includes('FCU-01'))
    return g?.getAttribute('data-id') || ''
  }, oduId!)
  expect(fcuBefore).toBeTruthy()
  const fcuRectBefore = (await nodeRectInWorld(page, fcuBefore))!

  await page.keyboard.down('Shift')
  await page.mouse.click(fcuPt.x, fcuPt.y)
  await page.keyboard.up('Shift')

  const alignTrigger = toolbar.getByRole('button', { name: 'Rata' })
  await alignTrigger.focus()
  await page.keyboard.press('Enter')
  const alignMenu = page.getByRole('menu')
  await expect(alignMenu).toBeVisible()
  await page.keyboard.press('Enter') // item pertama: "Rata kiri"

  const fcuRectAfterAlign = (await nodeRectInWorld(page, fcuBefore))!
  expect(fcuRectAfterAlign.x).toBeLessThan(fcuRectBefore.x - 500)

  // Undo Rata kiri mengembalikan posisi FCU tepat seperti semula
  await page.keyboard.press('Control+z')
  const fcuRectAfterUndo = (await nodeRectInWorld(page, fcuBefore))!
  expect(Math.abs(fcuRectAfterUndo.x - fcuRectBefore.x)).toBeLessThan(2)

  // 3. Menu klik kanan (UContextMenu) pada ODU -> pilih "Kunci" lewat keyboard -> lencana kunci + tombol "Buka kunci" -> Undo
  await page.keyboard.press('Escape')
  await page.mouse.click(oduPt.x, oduPt.y, { button: 'right' })

  const ctxMenu = page.getByRole('menu')
  await expect(ctxMenu).toBeVisible()
  const lockItem = ctxMenu.getByRole('menuitem', { name: 'Kunci', exact: true })
  await expect(lockItem).toBeVisible()
  await lockItem.focus()
  await page.keyboard.press('Enter')

  await expect(page.getByTestId('lock-badge')).toBeVisible()
  await expect(toolbar.getByRole('button', { name: 'Buka kunci' })).toBeVisible()

  // Undo Kunci membuka kunci kembali
  await page.keyboard.press('Control+z')
  await expect(page.getByTestId('lock-badge')).toHaveCount(0)

  // 4. Urutan: tekan ']' (Ke depan) lalu '[' (Ke belakang) lalu Undo
  const eqOrder = async () => page.evaluate(() => (
    [...document.querySelectorAll('#world g[data-layer="eq"] > [data-id]')].map(el => el.getAttribute('data-id'))
  ))
  await page.keyboard.press(']')
  expect((await eqOrder()).at(-1)).toBe(oduId)
  await page.keyboard.press('[')
  expect((await eqOrder())[0]).toBe(oduId)
  await page.keyboard.press('Control+z')
  expect((await eqOrder()).at(-1)).toBe(oduId)

  expect(errors).toEqual([])
})
