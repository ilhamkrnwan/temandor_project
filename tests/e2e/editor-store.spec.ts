import { expect, test } from '@playwright/test'

test('undo/redo (tombol & Ctrl+Z/Y) dan autosave IndexedDB bertahan setelah reload', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  const projectId = `uji-autosave-${Date.now()}`
  await page.goto(`/editor/${projectId}?baru=1`)

  const nameInput = page.getByRole('textbox', { name: 'Nama proyek' })
  const undoBtn = page.getByRole('button', { name: 'Urungkan' })
  const redoBtn = page.getByRole('button', { name: 'Ulangi' })
  const saveStatus = page.getByTestId('save-status')

  await expect(nameInput).toHaveValue('Proyek baru')
  await expect(undoBtn).toBeDisabled()
  await expect(redoBtn).toBeDisabled()

  // Tidak ada overflow horizontal pada desktop maupun HP
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  // Lakukan 3 perubahan berturut-turut
  for (const label of ['Tahap 1', 'Tahap 2', 'Tahap 3']) {
    await nameInput.fill(label)
    await nameInput.press('Enter')
    await expect(nameInput).toHaveValue(label)
  }

  await expect(undoBtn).toBeEnabled()
  await expect(redoBtn).toBeDisabled()

  // Undo 1 lewat tombol -> Tahap 2
  await undoBtn.click()
  await expect(nameInput).toHaveValue('Tahap 2')
  await expect(redoBtn).toBeEnabled()

  // Undo 2 lewat keyboard Ctrl+Z -> Tahap 1
  await page.keyboard.press('Control+z')
  await expect(nameInput).toHaveValue('Tahap 1')

  // Redo 1 lewat keyboard Ctrl+Y -> Tahap 2
  await page.keyboard.press('Control+y')
  await expect(nameInput).toHaveValue('Tahap 2')

  // Tunggu debounce autosave 500 ms selesai menulis ke IndexedDB
  await expect(saveStatus).toHaveText(/^Tersimpan \d{2}[.:]\d{2}$/, { timeout: 5000 })

  // Reload halaman editor: perubahan terakhir ("Tahap 2") harus termuat kembali dari IndexedDB
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Nama proyek' })).toHaveValue('Tahap 2')
  await expect(page.getByTestId('save-status')).toHaveText(/^Tersimpan \d{2}[.:]\d{2}$/)
  await expect(page.getByRole('button', { name: 'Urungkan' })).toBeDisabled()

  expect(errors).toEqual([])
})
