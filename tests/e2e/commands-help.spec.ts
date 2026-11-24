import { expect, test } from '@playwright/test'

test('baris perintah AutoCAD, dialog pintasan ?, dan petunjuk awal muncul sekali saja', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  // 1. Proyek kosong baru -> petunjuk awal (#empty-hint) tampil, ditutup -> tidak muncul lagi setelah reload
  const freshId = `uji-hint-${Date.now()}`
  await page.goto(`/editor/${freshId}?baru=1`)

  const hintCard = page.getByTestId('onboarding-hint')
  await expect(hintCard).toBeVisible()
  await page.getByTestId('hint-close').click()
  await expect(hintCard).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('temandor.nohint'))).toBe('1')

  await page.reload()
  await expect(page.getByTestId('onboarding-hint')).toHaveCount(0)

  // Tidak ada overflow horizontal pada desktop maupun HP
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  // 2. Baris perintah (#cmd): L -> duct, PAN -> pan, SELECT -> select, BOQ -> toast, tidak dikenal -> toast
  const cmd = page.getByRole('textbox', { name: 'Baris perintah' })
  const svg = page.locator('#cad')
  await expect(cmd).toBeVisible()

  await cmd.fill('L')
  await cmd.press('Enter')
  await expect(svg).toHaveAttribute('data-tool', 'duct')
  await expect(page.getByTestId('cmd-hint')).toContainText('Duct')

  await cmd.fill('REC')
  await cmd.press('Enter')
  await expect(svg).toHaveAttribute('data-tool', 'room')

  await cmd.fill('PAN')
  await cmd.press('Enter')
  await expect(svg).toHaveAttribute('data-tool', 'pan')

  await cmd.fill('SELECT')
  await cmd.press('Enter')
  await expect(svg).toHaveAttribute('data-tool', 'select')

  await cmd.fill('BOQ')
  await cmd.press('Enter')
  await expect(page.getByTestId('boq-dialog-body')).toBeVisible()
  await page.getByRole('button', { name: 'Tutup', exact: true }).click()
  await expect(page.getByTestId('boq-dialog-body')).toBeHidden()

  await cmd.fill('TIDAKADA')
  await cmd.press('Enter')
  await expect(page.getByText('Perintah "TIDAKADA" tidak dikenal', { exact: true })).toBeVisible()

  // 3. Dialog pintasan '?' lewat keyboard (fokus kanvas) menampilkan pintasan dari tabel sumber tunggal
  await svg.focus()
  await page.keyboard.press('?')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('[data-shortcut-id="edit:undo"]')).toBeVisible()
  await expect(dialog.locator('[data-shortcut-id="view:toggle-snap"]')).toBeVisible()
  await expect(dialog.locator('[data-shortcut-id="view:focus-mode"]')).toBeVisible()
  await expect(dialog.locator('[data-command-ref="BOQ"]')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)

  expect(errors).toEqual([])
})
