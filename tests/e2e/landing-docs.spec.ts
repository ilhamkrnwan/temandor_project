import { readFileSync, statSync } from 'node:fs'
import { expect, test } from '@playwright/test'

test('landing page /: gambar SVG nyata dari demoProject, kamera pin interaktif, toggle layer DXF, unduh DXF contoh, dan form kop proyek baru', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sketsa ducting rapi')

  // Meta SEO & Open Graph lengkap
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Temandor/)
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /DXF/)

  // Gambar hero dirender langsung sebagai SVG vektor nyata (bukan gambar statis) dengan 5 pin
  const heroDrawing = page.getByTestId('landing-hero-drawing')
  await expect(heroDrawing.locator('svg')).toBeVisible()
  await expect(heroDrawing.locator('svg g.pin')).toHaveCount(5)

  // Tidak memakai foto placeholder eksternal Unsplash
  await expect(page.locator('img[src*="unsplash.com"]')).toHaveCount(0)

  // Klik catatan punch list memfokuskan pin pada kamera
  const camSvg = page.getByTestId('landing-cam').locator('svg')
  const vbInitial = await camSvg.getAttribute('viewBox')
  await page.getByTestId('landing-pin-btn-1').click()
  const vbFocused = await camSvg.getAttribute('viewBox')
  expect(vbFocused).not.toBe(vbInitial)

  // Toggle layer DXF menyalakan/mematikan layer di pratinjau langsung
  await expect(page.getByTestId('landing-layers-count')).toHaveText('10 dari 10 menyala')
  await page.getByTestId('landing-layer-sa').click()
  await expect(page.getByTestId('landing-layers-count')).toHaveText('9 dari 10 menyala')
  await page.getByTestId('landing-layer-sa').click()
  await expect(page.getByTestId('landing-layers-count')).toHaveText('10 dari 10 menyala')

  // Tombol Unduh DXF contoh mengunduh file DXF R12 valid
  const dxfPromise = page.waitForEvent('download')
  await page.getByTestId('landing-download-dxf').click()
  const dxfDownload = await dxfPromise
  expect(dxfDownload.suggestedFilename()).toBe('contoh-temandor.dxf')
  const dxfPath = await dxfDownload.path()
  expect(statSync(dxfPath!).size).toBeGreaterThan(5000)
  expect(readFileSync(dxfPath!, 'utf8')).toContain('AC1009')

  // Tidak ada overflow horizontal pada desktop maupun HP
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  // Form kop gambar membuat proyek baru nyata di IndexedDB dan membuka editor
  await page.getByTestId('kop-name').fill('Gudang Uji Landing')
  await page.getByTestId('kop-w').fill('8')
  await page.getByTestId('kop-h').fill('5')
  await page.getByTestId('kop-submit').click()
  await expect(page).toHaveURL(/\/editor\/[A-Za-z0-9_-]+$/)
  await expect(page.getByRole('textbox', { name: 'Nama proyek' })).toHaveValue('Gudang Uji Landing')

  expect(errors).toEqual([])
})

test('halaman /docs: semua tautan anchor internal valid, daftar pintasan & layer DXF dari sumber tunggal', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  await page.goto('/docs')
  await expect(page.getByRole('heading', { level: 1, name: 'Dokumentasi' })).toBeVisible()

  // Tabel layer DXF berasal dari LAYERS & memuat semua layer inti
  const layerTable = page.getByTestId('docs-layer-table')
  await expect(layerTable).toContainText('DUCT-SA')
  await expect(layerTable).toContainText('DUCT-EA')
  await expect(layerTable).toContainText('EQUIPMENT')
  await expect(layerTable).toContainText('A-WALL')

  // Bagian AI & MCP memuat tabel tool dari @temandor/core serta panduan Claude Code / Desktop
  await expect(page.getByTestId('docs-ai-tools-table')).toContainText('get_project')
  await expect(page.getByTestId('docs-ai-tools-table')).toContainText('draw_duct')
  await expect(page.locator('#mcp')).toContainText('claude mcp add temandor')
  await expect(page.locator('#mcp')).toContainText('claude_desktop_config.json')

  // Bagian Kontribusi memuat perintah Nuxt/Bun & lisensi Apache 2.0
  await expect(page.locator('#kontribusi')).toContainText('bun run dev')
  await expect(page.locator('#kontribusi')).toContainText('Apache 2.0')

  // Klik & verifikasi SEMUA tautan anchor internal (#...) di halaman /docs
  const anchorHrefs = await page.locator('a[href^="#"]').evaluateAll(links => (
    [...new Set(links.map(a => a.getAttribute('href')).filter((h): h is string => Boolean(h && h.length > 1)))]
  ))
  expect(anchorHrefs.length).toBeGreaterThanOrEqual(11)

  for (const href of anchorHrefs) {
    const id = href.slice(1)
    const target = page.locator(`[id="${id}"]`)
    await expect(target, `Target anchor ${href} harus ada di /docs`).toBeVisible()
    const visibleLink = page.locator(`a[href="${href}"]:visible`).first()
    if (await visibleLink.count() > 0) {
      await visibleLink.click()
      await expect(page).toHaveURL(new RegExp(`#${id}$`))
    }
  }

  // Tidak ada overflow horizontal pada desktop maupun HP
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  expect(errors).toEqual([])
})
