import { expect, test } from '@playwright/test'

test('shell workspace: rail 5 kategori, panel buka/tutup, properti melayang, mode fokus, dan bottom sheet HP', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  await page.goto('/editor/contoh')

  const isMobile = testInfo.project.name === 'hp'
  const rail = page.locator('#rail')
  const lib = page.getByTestId('workspace-lib')
  const side = page.getByTestId('workspace-side')

  await expect(rail).toBeVisible()
  for (const label of ['Elemen', 'Alat', 'Teks', 'Layer', 'Proyek']) {
    await expect(rail.getByRole('button', { name: label })).toBeVisible()
  }

  // Tidak ada overflow horizontal pada desktop maupun HP
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  if (!isMobile) {
    // Desktop: panel kiri terbuka default di Elemen, panel properti tersembunyi sebelum ada pilihan
    await expect(lib).not.toHaveClass(/is-hidden/)
    await expect(side).toHaveClass(/is-hidden/)

    // Klik kategori lain (Layer) mengganti isi panel; klik lagi pada kategori aktif menutup panel
    const layerBtn = rail.getByRole('button', { name: 'Layer' })
    await layerBtn.click()
    await expect(layerBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(lib).toContainText('DUCT-SA')

    await layerBtn.click()
    await expect(lib).toHaveClass(/is-hidden/)
    await expect(layerBtn).toHaveAttribute('aria-pressed', 'false')

    // Ctrl+[ membuka panel kiri lagi
    await page.keyboard.press('Control+[')
    await expect(lib).not.toHaveClass(/is-hidden/)

    // Pilih komponen via Tab di kanvas -> panel properti melayang kanan muncul
    await page.locator('#cad').focus()
    await page.keyboard.press('Tab')
    await expect(side).not.toHaveClass(/is-hidden/)
    await expect(side).toContainText('Properti')

    // Ctrl+] menutup panel properti -> tab buka-ulang muncul di tepi kanan
    await page.keyboard.press('Control+]')
    await expect(side).toHaveClass(/is-hidden/)
    await expect(page.getByTestId('reopen-side')).toBeVisible()

    // Mode fokus (Ctrl+.) menutup semua panel lalu membuka kembali
    await page.keyboard.press('Control+.')
    await expect(lib).toHaveClass(/is-hidden/)
    await expect(side).toHaveClass(/is-hidden/)
    await expect(page.getByTestId('focus-mode-btn')).toHaveAttribute('aria-pressed', 'true')

    await page.keyboard.press('Control+.')
    await expect(lib).not.toHaveClass(/is-hidden/)
    await expect(side).not.toHaveClass(/is-hidden/)
  }
  else {
    // HP (ADR 0009): rail berada di bawah layar sebagai tab bar; panel tertutup default
    const railBox = (await rail.boundingBox())!
    const viewportHeight = page.viewportSize()!.height
    expect(railBox.y + railBox.height).toBeGreaterThanOrEqual(viewportHeight - 2)
    await expect(lib).toHaveClass(/is-hidden/)
    await expect(side).toHaveClass(/is-hidden/)

    // Ketuk tab Elemen -> bottom sheet panel kiri + scrim tampil
    await rail.getByRole('button', { name: 'Elemen' }).click()
    await expect(lib).not.toHaveClass(/is-hidden/)
    await expect(page.getByTestId('mobile-scrim')).toHaveClass(/is-open/)

    // Ketuk tombol Properti di bilah atas -> beralih ke bottom sheet properti
    await page.getByTestId('mobile-props-btn').click()
    await expect(lib).toHaveClass(/is-hidden/)
    await expect(side).not.toHaveClass(/is-hidden/)

    // Ketuk scrim menutup sheet
    await page.getByTestId('mobile-scrim').click({ position: { x: 20, y: 20 } })
    await expect(side).toHaveClass(/is-hidden/)
  }

  // Tombol Export membuka modal Export
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByTestId('export-fmt-dxf')).toBeVisible()
  await page.getByRole('button', { name: 'Tutup', exact: true }).click()

  expect(errors).toEqual([])
})
