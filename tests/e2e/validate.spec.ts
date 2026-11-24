import { expect, test } from '@playwright/test'

test('validasi & warning: tanda ! di kanvas, tooltip hover, klik pilih + cara perbaikan di panel, drawer warning, dan tidak menghalangi export', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  const isMobile = testInfo.project.name === 'hp'

  await page.goto('/editor/contoh')

  const svg = page.locator('#cad')
  await expect(svg).toBeVisible()

  // 1. Proyek contoh memiliki tepat 2 warning yang disengaja: open + size
  const warnBtn = page.getByTestId('warn-btn')
  await expect(warnBtn).toContainText('2 warning')

  const markers = page.getByTestId('warn-marker')
  await expect(markers).toHaveCount(2)
  await expect(page.locator('[data-testid="warn-marker"][data-warn-kind="open"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="warn-marker"][data-warn-kind="size"]')).toHaveCount(1)

  // 2. Hover tanda ! di desktop menampilkan tooltip berisi pesan, detail, dan ajakan klik
  const sizeMarker = page.locator('[data-testid="warn-marker"][data-warn-kind="size"]')
  if (!isMobile) {
    const mBox = (await sizeMarker.boundingBox())!
    await page.mouse.move(mBox.x + mBox.width / 2, mBox.y + mBox.height / 2)
    const tip = page.getByTestId('warn-tooltip')
    await expect(tip).toBeVisible()
    await expect(tip).toContainText('Ukuran beda tanpa transisi')
    await expect(tip).toContainText('Tambah transisi')
    await expect(tip).toContainText('Klik untuk pilih komponennya')
  }

  // 3. Klik tanda ! memilih komponen terkait dan membuka panel properti berisi cara perbaikan
  const mBoxClick = (await sizeMarker.boundingBox())!
  await page.mouse.click(mBoxClick.x + mBoxClick.width / 2, mBoxClick.y + mBoxClick.height / 2)

  await expect(page.getByTestId('selection-count')).toContainText('1 dipilih')
  await expect(page.getByTestId('workspace-side')).toBeVisible()
  const propWarn = page.getByTestId('prop-warning')
  await expect(propWarn).toHaveCount(1)
  await expect(propWarn).toContainText('Ukuran beda tanpa transisi')
  await expect(propWarn).toContainText('Tambah transisi')

  // Pada HP, tutup bottom sheet Properti sebelum membuka drawer warning agar jelas
  if (isMobile) {
    await page.getByTestId('workspace-side').getByRole('button', { name: 'Tutup properti' }).click()
  }

  // 4. Klik tombol warning di status bar membuka drawer daftar warning + menampilkan label di kanvas
  await warnBtn.click()
  const drawer = page.getByTestId('warn-drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer).toContainText('2 WARNING')
  await expect(drawer).toContainText('tidak menghalangi simpan / export')
  await expect(page.getByTestId('warn-item')).toHaveCount(2)
  await expect(page.getByTestId('warn-marker-label')).toHaveCount(2)

  // Klik item "open" di drawer memilih duct ujung terbuka dan memusatkan viewport
  const vbBefore = await svg.getAttribute('viewBox')
  await drawer.locator('[data-testid="warn-item"][data-warn-kind="open"]').click()
  await expect(page.getByTestId('prop-warning')).toContainText('Ujung terbuka')
  await expect(page.getByTestId('prop-warning')).toContainText('end cap')
  await expect.poll(async () => await svg.getAttribute('viewBox')).not.toBe(vbBefore)

  if (!isMobile) {
    await page.getByTestId('warn-close').click()
    await expect(drawer).toHaveCount(0)
  }

  // 5. Simpan dan Export tetap dapat dibuka (warning tidak pernah melarang)
  await page.getByRole('button', { name: 'Export' }).click()
  await expect(page.getByTestId('export-warn-notice')).toContainText('Ada 2 warning pada gambar')
  await expect(page.getByTestId('export-submit-btn')).toBeEnabled()
  await page.getByRole('button', { name: 'Tutup' }).click()

  // 6. Tidak ada overflow horizontal pada desktop maupun HP
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  expect(errors).toEqual([])
})
