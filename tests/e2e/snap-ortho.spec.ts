import { expect, test } from '@playwright/test'

test('toggle SNAP (F3), ORTHO (F8 + Shift sementara), dan penanda snap di overlay', async ({ page }) => {
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

  const snapBtn = page.getByRole('button', { name: 'SNAP' })
  const orthoBtn = page.getByRole('button', { name: 'ORTHO' })
  const gridBtn = page.getByRole('button', { name: 'GRID' })

  await expect(snapBtn).toBeVisible()
  await expect(orthoBtn).toBeVisible()
  await expect(gridBtn).toBeVisible()

  // Default aktif semua
  await expect(snapBtn).toHaveAttribute('aria-pressed', 'true')
  await expect(orthoBtn).toHaveAttribute('aria-pressed', 'true')

  // Tidak ada overflow horizontal pada desktop maupun HP
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  // Klik & F3 untuk SNAP
  await snapBtn.click()
  await expect(snapBtn).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('F3')
  await expect(snapBtn).toHaveAttribute('aria-pressed', 'true')

  // Klik & F8 untuk ORTHO
  await orthoBtn.click()
  await expect(orthoBtn).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('F8')
  await expect(orthoBtn).toHaveAttribute('aria-pressed', 'true')

  // Shift sementara membalik status ORTHO selama ditahan lalu kembali saat dilepas
  await page.keyboard.down('Shift')
  await expect(orthoBtn).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.up('Shift')
  await expect(orthoBtn).toHaveAttribute('aria-pressed', 'true')

  // Arahkan kursor ke sudut ruangan (0, 0) di proyek contoh -> penanda snap 'end' tampil di overlay
  const pos = await page.evaluate(() => {
    const el = document.querySelector('#cad') as SVGSVGElement
    const box = el.getBoundingClientRect()
    const [vx, vy, vw, vh] = (el.getAttribute('viewBox') || '0 0 1000 1000').split(/\s+/).map(Number)
    const scale = Math.min(box.width / vw!, box.height / vh!)
    const ox = (box.width - vw! * scale) / 2
    const oy = (box.height - vh! * scale) / 2
    return {
      x: box.left + ox + (0 - vx!) * scale,
      y: box.top + oy + (0 - vy!) * scale,
    }
  })
  await page.mouse.move(pos.x, pos.y)
  const marker = page.getByTestId('snap-marker')
  await expect(marker).toBeVisible()
  await expect(marker).toHaveAttribute('data-snap-kind', 'end')

  // Matikan SNAP (F3) -> penanda snap hilang
  await page.keyboard.press('F3')
  await expect(marker).toHaveCount(0)

  expect(errors).toEqual([])
})
