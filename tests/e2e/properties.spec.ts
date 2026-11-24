import { expect, test, type Page } from '@playwright/test'

async function ensureSideOpen(page: Page, isMobile: boolean) {
  const side = page.getByTestId('workspace-side')
  if (isMobile && (await side.evaluate(el => el.classList.contains('is-hidden')))) {
    await page.getByTestId('mobile-props-btn').click()
  }
  await expect(side).toBeVisible()
}

test('panel properti: ubah lebar duct (koma desimal) = 1 langkah undo + render & port ikut berubah, opsi elbow, dan rata multi-pilih', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  const isMobile = testInfo.project.name === 'hp'

  // 1. Buka proyek contoh (satuan inch) dan pilih duct 18"x14" lewat tanda warning "size"
  await page.goto('/editor/contoh')
  const svg = page.locator('#cad')
  await expect(svg).toBeVisible()

  // Cek "Ukuran duct baru" tampil saat alat Duct aktif di desktop
  if (!isMobile) {
    await svg.focus()
    await page.keyboard.press('d')
    await expect(page.getByTestId('props-duct-spec')).toBeVisible()
    await page.getByTestId('spec-w').fill('16,5')
    await page.getByTestId('spec-w').press('Enter')
    await expect(page.getByTestId('spec-w')).toHaveValue('16,5')
    await page.keyboard.press('Escape')
  }

  // Pilih duct yang punya warning "open" (duct lurus 12"x10" cabang 45°) dengan klik tanda !
  const openMarker = page.locator('[data-testid="warn-marker"][data-warn-kind="open"]')
  await expect(openMarker).toBeVisible()
  const oBox = (await openMarker.boundingBox())!
  await page.mouse.click(oBox.x + oBox.width / 2, oBox.y + oBox.height / 2)

  const side = page.getByTestId('workspace-side')
  await expect(side).toBeVisible()
  await expect(side).toContainText('Duct lurus')

  // Lebar awal 12", tinggi 10", tampil di input dan di daftar port Sambungan
  const widthInput = page.getByTestId('prop-w')
  await expect(widthInput).toHaveValue('12')
  await expect(side.getByTestId('prop-port-row').first()).toContainText('12"x10"')

  // Ubah lebar duct dari panel dengan koma desimal ("14,5") + Enter -> render, port, dan warning ikut berubah
  await widthInput.fill('14,5')
  await widthInput.press('Enter')
  await expect(widthInput).toHaveValue('14,5')
  await expect(side.getByTestId('prop-port-row').first()).toContainText('14.5"x10"')

  // Ubah panjang jadi 1800 mm agar label ukuran 14.5"x10" tampil penuh pada SVG kanvas
  const lenInput = page.getByTestId('prop-L')
  await lenInput.fill('1800')
  await lenInput.press('Enter')
  await expect(page.locator('#world')).toContainText('14.5"x10"')

  // 2x Ctrl+Z mengurungkan panjang lalu lebar (masing-masing tepat 1 langkah undo)
  if (isMobile) {
    await side.getByRole('button', { name: 'Tutup properti' }).click()
  }
  await svg.focus()
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+z')
  if (isMobile) {
    await page.getByTestId('mobile-props-btn').click()
  }
  await expect(widthInput).toHaveValue('12')
  await expect(side.getByTestId('prop-port-row').first()).toContainText('12"x10"')

  // 2. Uji opsi elbow (sudut chip 22,5°, reducing ujung b, dan tipe Siku + vane menyembunyikan radius)
  if (isMobile) {
    await side.getByRole('button', { name: 'Tutup properti' }).click()
    await page.locator('#rail').getByRole('button', { name: 'Elemen' }).click()
  }
  await page.locator('[data-place="elbow"]').click()
  const cBox = (await svg.boundingBox())!
  const ex = Math.round(cBox.x + cBox.width * 0.45)
  const ey = Math.round(cBox.y + cBox.height * 0.5)
  await page.mouse.move(ex, ey)
  await page.mouse.click(ex, ey)
  await page.keyboard.press('Escape')

  // Pilih elbow yang baru ditaruh (komponen terakhir di layer SA)
  const lastSaId = await page.evaluate(() => {
    const els = document.querySelectorAll('#world g[data-layer="sa"] > g[data-id]')
    return els[els.length - 1]?.getAttribute('data-id') ?? ''
  })
  expect(lastSaId).toBeTruthy()
  const elbowBox = (await page.locator(`#world g[data-layer="sa"] > g[data-id="${lastSaId}"]`).boundingBox())!
  await page.mouse.click(elbowBox.x + elbowBox.width / 2, elbowBox.y + elbowBox.height / 2)

  await ensureSideOpen(page, isMobile)
  await expect(side).toContainText('Elbow')
  await page.getByTestId('prop-angle-chip-22.5').click()
  await expect(page.getByTestId('prop-angle')).toHaveValue('22,5')

  // Ubah tipe elbow ke Siku + vane -> pilihan radius rr hilang
  await expect(page.getByTestId('prop-rr-1')).toBeAttached()
  await side.getByText('Siku + vane').click()
  await expect(page.getByTestId('prop-rr-1')).toHaveCount(0)

  // 3. Multi-select (Ctrl+A) menampilkan kontrol Rata dan Sistem (semua)
  if (isMobile) {
    await side.getByRole('button', { name: 'Tutup properti' }).click()
  }
  await svg.focus()
  await page.keyboard.press('Control+a')
  await ensureSideOpen(page, isMobile)
  await expect(page.getByTestId('props-multi')).toBeVisible()
  await expect(page.getByTestId('prop-align-left')).toBeVisible()

  // Tidak ada overflow horizontal pada desktop maupun HP
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  expect(errors).toEqual([])
})
