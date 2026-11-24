import { expect, test, type Page } from '@playwright/test'

async function countLayerNodes(page: Page, layer: string): Promise<number> {
  return page.locator(`#world g[data-layer="${layer}"] > g[data-id]`).count()
}

test('panel Elemen (6 kelompok + ikon SVG), cari komponen, seret diffuser ke kanvas, klik-taruh + R putar, dan undo', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  const isMobile = testInfo.project.name === 'hp'
  const freshId = `uji-lib-${Date.now()}`
  await page.goto(`/editor/${freshId}?baru=1`)

  const hintCard = page.getByTestId('onboarding-hint')
  await expect(hintCard).toBeVisible()
  await page.getByTestId('hint-close').click()
  await expect(hintCard).toHaveCount(0)

  const svg = page.locator('#cad')
  await expect(svg).toBeVisible()

  // Pada HP buka panel Elemen terlebih dahulu (bottom sheet tertutup default)
  if (isMobile) {
    await page.locator('#rail').getByRole('button', { name: 'Elemen' }).click()
    await expect(page.getByTestId('workspace-lib')).not.toHaveClass(/is-hidden/)
  }

  // 1. Verifikasi 6 kelompok library tampil lengkap dan seluruh ikon SVG termuat tanpa 404
  for (const groupId of ['ruangan', 'arsitektur', 'equipment', 'duct', 'fitting', 'perlengkapan']) {
    await expect(page.locator(`[data-lib-group="${groupId}"]`)).toBeVisible()
  }
  await expect(page.locator('#lib-groups [data-place]')).toHaveCount(29)

  const brokenIcons = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('#lib-groups img')] as HTMLImageElement[]
    return imgs.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src)
  })
  expect(brokenIcons).toEqual([])

  // 2. Uji pencarian di panel Elemen -> saring "diffuser"
  const search = page.locator('#lib-search')
  await search.fill('diffuser')
  await expect(page.locator('#lib-groups [data-place]')).toHaveCount(1)
  const diffuserBtn = page.locator('[data-place="diffuser"]')
  await expect(diffuserBtn).toBeVisible()

  expect(await countLayerNodes(page, 'diff')).toBe(0)

  const box = (await svg.boundingBox())!
  const dropX = Math.round(box.x + box.width * 0.55)
  const dropY = Math.round(box.y + box.height * 0.45)

  if (!isMobile) {
    // 3a. Desktop: seret diffuser langsung dari panel Elemen ke kanvas (HTML5 drag & drop)
    await diffuserBtn.dragTo(svg, {
      targetPosition: {
        x: Math.round(box.width * 0.55),
        y: Math.round(box.height * 0.45),
      },
    })
  }
  else {
    // 3b. HP: ketuk diffuser -> bottom sheet otomatis menutup -> ketuk kanvas untuk taruh
    await diffuserBtn.click()
    await expect(page.getByTestId('workspace-lib')).toHaveClass(/is-hidden/)
    await page.mouse.click(dropX, dropY)
    await page.keyboard.press('Escape')
  }

  expect(await countLayerNodes(page, 'diff')).toBe(1)

  // Undo (Ctrl+Z) menghapus diffuser, Redo (Ctrl+Y) mengembalikannya
  await svg.focus()
  await page.keyboard.press('Control+z')
  expect(await countLayerNodes(page, 'diff')).toBe(0)

  await page.keyboard.press('Control+y')
  expect(await countLayerNodes(page, 'diff')).toBe(1)

  // 4. Bersihkan pencarian lalu uji klik-untuk-taruh Indoor ducted (FCU) + putar R + undo
  if (isMobile) {
    await page.locator('#rail').getByRole('button', { name: 'Elemen' }).click()
  }
  await search.fill('')
  await expect(page.locator('#lib-groups [data-place]')).toHaveCount(29)

  await page.locator('[data-place="fcu"]').click()
  await expect(svg).toHaveAttribute('data-tool', 'place')

  const fcuX = Math.round(box.x + box.width * 0.35)
  const fcuY = Math.round(box.y + box.height * 0.4)
  await page.mouse.move(fcuX, fcuY)
  await expect(page.getByTestId('drag-ghost')).toBeVisible()

  await page.keyboard.press('r')
  await page.mouse.click(fcuX, fcuY)
  expect(await countLayerNodes(page, 'eq')).toBe(1)

  // Esc keluar dari mode taruh dan Ctrl+Z mengurungkan FCU
  await page.keyboard.press('Escape')
  await expect(svg).toHaveAttribute('data-tool', 'select')
  await page.keyboard.press('Control+z')
  expect(await countLayerNodes(page, 'eq')).toBe(0)

  // Tidak ada overflow horizontal pada desktop maupun HP
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  expect(errors).toEqual([])
})
