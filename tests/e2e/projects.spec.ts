import { expect, test } from '@playwright/test'

test('daftar proyek /proyek: thumbnail, proyek baru, cari, hapus dengan konfirmasi + urungkan, dan buka file .json', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  await page.goto('/proyek')

  // 1. Kunjungan pertama otomatis menampilkan proyek contoh dengan thumbnail SVG dan pengingat penyimpanan lokal
  await expect(page.getByTestId('local-storage-reminder')).toContainText('.json')
  const cards = page.getByTestId('project-card')
  await expect(cards).toHaveCount(1)
  await expect(cards.first()).toContainText('Contoh')
  await expect(cards.first()).toContainText('2 warning')
  await expect(cards.first()).toContainText('SA')
  await expect(cards.first()).toContainText('EA')

  // Pastikan thumbnail SVG termuat penuh (naturalWidth > 0)
  await expect.poll(async () => page.evaluate(() => {
    const img = document.querySelector('[data-testid="project-card"] img') as HTMLImageElement | null
    return Boolean(img && img.complete && img.naturalWidth > 0)
  })).toBe(true)

  // Tanpa katalog template maupun login (ADR 0008)
  await expect(page.getByText('Jadi penjual')).toHaveCount(0)
  await expect(page.getByText('Masuk')).toHaveCount(0)

  // 2. Buat proyek baru -> muncul di editor lalu tampil di daftar /proyek
  await page.getByTestId('new-project-btn').click()
  await expect(page.getByTestId('new-project-form')).toBeVisible()

  await page.getByTestId('new-project-name').fill('Gudang Barat')
  await page.getByTestId('new-unit-mm').check({ force: true })
  await page.getByTestId('new-project-scale').selectOption('1:50')
  await page.getByTestId('new-room-length').fill('12,5')
  await page.getByTestId('new-room-width').fill('8')
  await expect(page.getByTestId('new-room-preview')).toContainText('12,5 × 8 m')

  await page.getByTestId('create-project-submit').click()
  await expect(page).toHaveURL(/\/editor\/[^/]+$/)
  await expect(page.locator('#proj-name')).toHaveValue('Gudang Barat')

  // Kembali ke /proyek -> proyek baru tampil di daftar
  await page.getByRole('link', { name: 'Kembali ke proyek' }).click()
  await expect(page).toHaveURL(/\/proyek$/)
  await expect(cards).toHaveCount(2)
  await expect(page.getByTestId('project-grid')).toContainText('Gudang Barat')

  // 3. Pencarian menyaring kartu proyek
  const search = page.getByTestId('project-search')
  await search.fill('Gudang')
  await expect(cards).toHaveCount(1)
  await expect(cards.first()).toContainText('Gudang Barat')
  await search.fill('')
  await expect(cards).toHaveCount(2)

  // 4. Hapus proyek "Gudang Barat" -> konfirmasi -> hilang -> klik Urungkan di toast -> kembali tampil
  const gudangCard = cards.filter({ hasText: 'Gudang Barat' })
  await gudangCard.getByTestId('project-delete').click()
  await expect(page.getByTestId('confirm-delete-project')).toBeVisible()
  await page.getByTestId('confirm-delete-project').click()

  await expect(cards).toHaveCount(1)
  await expect(page.getByTestId('project-grid')).not.toContainText('Gudang Barat')

  const undoBtn = page.getByRole('button', { name: 'Urungkan' })
  await expect(undoBtn).toBeVisible()
  await undoBtn.click()
  await expect(cards).toHaveCount(2)
  await expect(page.getByTestId('project-grid')).toContainText('Gudang Barat')

  // Reload memastikan proyek yang dipulihkan benar-benar tersimpan di IndexedDB
  await page.reload()
  await expect(cards).toHaveCount(2)
  await expect(page.getByTestId('project-grid')).toContainText('Gudang Barat')

  // 5. Buka file .json rusak menampilkan toast error tanpa crash, sedangkan file prototype v1 terbuka otomatis
  await page.getByTestId('import-json-input').setInputFiles({
    name: 'rusak.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{ bukan json valid', 'utf8'),
  })
  await expect(page.getByText('Gagal membuka file', { exact: true })).toBeVisible()

  const protoV1 = {
    v: 1,
    id: 'legacy-v1',
    name: 'Impor Prototype V1',
    unit: 'mm',
    scale: '1:100',
    nodes: [
      { id: 'rm1', type: 'room', x: 0, y: 0, W: 5000, H: 4000, t: 150, name: 'Ruang V1' },
      { id: 'st1', type: 'straight', x: 1000, y: 1500, L: 2000, w: 400, h: 300, shape: 'rect', sys: 'SA' },
    ],
  }
  await page.getByTestId('import-json-input').setInputFiles({
    name: 'impor-v1.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(protoV1), 'utf8'),
  })
  await expect(page).toHaveURL(/\/editor\/[^/]+$/)
  await expect(page.locator('#proj-name')).toHaveValue('Impor Prototype V1')

  // 6. Tidak ada overflow horizontal pada desktop maupun HP
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  expect(errors).toEqual([])
})
