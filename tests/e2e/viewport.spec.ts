import { expect, test, type Page } from '@playwright/test'

type ViewBoxTuple = [number, number, number, number]

async function readViewBox(page: Page): Promise<ViewBoxTuple> {
  const raw = await page.locator('#cad').getAttribute('viewBox')
  expect(raw).toBeTruthy()
  const parts = raw!.trim().split(/\s+/).map(Number)
  expect(parts).toHaveLength(4)
  return parts as ViewBoxTuple
}

function clientToWorld(
  vb: ViewBoxTuple,
  box: { x: number, y: number, width: number, height: number },
  clientX: number,
  clientY: number,
): [number, number] {
  const scale = Math.min(box.width / vb[2], box.height / vb[3])
  const ox = (box.width - vb[2] * scale) / 2
  const oy = (box.height - vb[3] * scale) / 2
  return [
    vb[0] + (clientX - box.x - ox) / scale,
    vb[1] + (clientY - box.y - oy) / scale,
  ]
}

test('zoom roda mouse di titik kursor, geser kanvas, grid adaptif, crosshair, dan status bar', async ({ page }) => {
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
  await expect(svg).toHaveCSS('touch-action', 'none')
  await expect(page.locator('#grid')).toBeVisible()

  // Tidak ada overflow horizontal pada viewport desktop maupun HP
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  const box = (await svg.boundingBox())!
  expect(box.width).toBeGreaterThan(200)
  expect(box.height).toBeGreaterThan(200)

  const initialVb = await readViewBox(page)

  // Gerakkan mouse ke titik off-center (koordinat piksel bulat): crosshair muncul dan koordinat mm terupdate
  const targetX = Math.round(box.x + box.width * 0.65)
  const targetY = Math.round(box.y + box.height * 0.35)
  await page.mouse.move(targetX, targetY)
  await expect(page.getByTestId('crosshair')).toBeVisible()

  const worldAtCursor = clientToWorld(initialVb, box, targetX, targetY)
  const expectedCoord = `X ${Math.round(worldAtCursor[0])}  Y ${Math.round(-worldAtCursor[1])}`
  await expect(page.getByTestId('coord')).toHaveText(expectedCoord)

  // Scroll zoom-in pada titik kursor: lebar viewBox mengecil dan titik dunia di bawah kursor tetap
  await page.mouse.wheel(0, -120)
  await page.mouse.wheel(0, -120)
  await page.mouse.wheel(0, -120)

  await expect.poll(async () => (await readViewBox(page))[2]).toBeLessThan(initialVb[2] * 0.75)
  const zoomedInVb = await readViewBox(page)
  const worldAfterZoom = clientToWorld(zoomedInVb, box, targetX, targetY)
  expect(Math.abs(worldAfterZoom[0] - worldAtCursor[0])).toBeLessThan(10)
  expect(Math.abs(worldAfterZoom[1] - worldAtCursor[1])).toBeLessThan(10)

  const zoomText = await page.getByTestId('zoom-fit').innerText()
  expect(Number.parseInt(zoomText, 10)).toBeGreaterThan(120)

  // Scroll zoom-out memperbesar lebar viewBox kembali
  await page.mouse.wheel(0, 120)
  await expect.poll(async () => (await readViewBox(page))[2]).toBeGreaterThan(zoomedInVb[2])

  // Geser kanvas dengan tombol tengah mouse
  const beforeMidPan = await readViewBox(page)
  const midX = box.x + box.width * 0.5
  const midY = box.y + box.height * 0.5
  await page.mouse.move(midX, midY)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(midX + 90, midY - 45)
  await page.mouse.up({ button: 'middle' })

  const afterMidPan = await readViewBox(page)
  expect(afterMidPan[0]).toBeLessThan(beforeMidPan[0] - 50)
  expect(afterMidPan[1]).toBeGreaterThan(beforeMidPan[1] + 25)
  expect(Math.abs(afterMidPan[2] - beforeMidPan[2])).toBeLessThan(1)

  // Geser kanvas lewat tombol alat Geser kanvas (H)
  const panBtn = page.getByRole('button', { name: 'Geser kanvas' })
  await panBtn.click()
  await expect(panBtn).toHaveAttribute('aria-pressed', 'true')
  await expect(svg).toHaveAttribute('data-tool', 'pan')

  await page.mouse.move(midX, midY)
  await page.mouse.down({ button: 'left' })
  await page.mouse.move(midX - 70, midY + 50)
  await page.mouse.up({ button: 'left' })

  const afterToolPan = await readViewBox(page)
  expect(afterToolPan[0]).toBeGreaterThan(afterMidPan[0] + 40)
  expect(afterToolPan[1]).toBeLessThan(afterMidPan[1] - 25)

  // Kembali ke alat Pilih lewat tombol toolbar
  await page.getByRole('button', { name: 'Pilih' }).click()
  await expect(svg).toHaveAttribute('data-tool', 'select')

  // Geser kanvas lewat Spasi + seret
  await page.keyboard.down('Space')
  await expect(svg).toHaveAttribute('data-tool', 'pan')
  await page.mouse.move(midX, midY)
  await page.mouse.down({ button: 'left' })
  await page.mouse.move(midX + 60, midY)
  await page.mouse.up({ button: 'left' })
  await page.keyboard.up('Space')
  await expect(svg).toHaveAttribute('data-tool', 'select')
  const afterSpacePan = await readViewBox(page)
  expect(afterSpacePan[0]).toBeLessThan(afterToolPan[0] - 30)

  // Toggle grid lewat tombol status bar dan F7
  const gridBtn = page.getByRole('button', { name: 'GRID' })
  await expect(gridBtn).toHaveAttribute('aria-pressed', 'true')
  await gridBtn.click()
  await expect(gridBtn).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('#grid')).toHaveCount(0)

  await page.keyboard.press('F7')
  await expect(gridBtn).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#grid')).toBeVisible()

  // Lihat semua lewat tombol persentase zoom (Shift+Z) mengembalikan skala 100%
  await page.getByTestId('zoom-fit').click()
  await expect(page.getByTestId('zoom-fit')).toContainText('100%')

  expect(errors).toEqual([])
})

test('sentuh dua jari: zoom + geser viewBox dan jari kedua membatalkan gestur satu jari', async ({ page }) => {
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
  const box = (await svg.boundingBox())!
  const initialVb = await readViewBox(page)
  const main = page.locator('main[aria-label="Kanvas gambar"]')
  await expect(main).toHaveAttribute('data-pinch-cancelled', '0')

  const cx = Math.round(box.x + box.width / 2)
  const cy = Math.round(box.y + box.height / 2)

  // Kirim gestur sentuh dua jari nyata lewat CDP Input.dispatchTouchEvent
  const cdp = await page.context().newCDPSession(page)

  // 1. Jari pertama menyentuh kanvas
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ id: 1, x: cx - 40, y: cy }],
  })
  // 2. Jari kedua turun -> harus membatalkan gerakan satu jari dan masuk mode pinch
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { id: 1, x: cx - 40, y: cy },
      { id: 2, x: cx + 40, y: cy },
    ],
  })

  await expect(main).toHaveAttribute('data-pinch-cancelled', '1')

  // 3. Lebarkan jarak kedua jari (80 px -> 180 px) sambil geser titik tengah ke kanan (+35 px) & bawah (+20 px)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { id: 1, x: cx - 55, y: cy + 20 },
      { id: 2, x: cx + 125, y: cy + 20 },
    ],
  })

  // 4. Angkat kedua jari
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })

  const afterPinchVb = await readViewBox(page)
  // Jarak jari melebar 2.25x -> lebar viewBox menyusut drastis (zoom in)
  expect(afterPinchVb[2]).toBeLessThan(initialVb[2] * 0.6)
  expect(afterPinchVb[3]).toBeLessThan(initialVb[3] * 0.6)
  // Titik tengah yang semula di (cx, cy) berpindah ke (cx+35, cy+20): titik dunia di bawah titik tengah lama tetap di bawah titik tengah baru
  const worldBefore = clientToWorld(initialVb, box, cx, cy)
  const worldAfter = clientToWorld(afterPinchVb, box, cx + 35, cy + 20)
  expect(Math.abs(worldAfter[0] - worldBefore[0])).toBeLessThan(15)
  expect(Math.abs(worldAfter[1] - worldBefore[1])).toBeLessThan(15)

  expect(errors).toEqual([])
})
