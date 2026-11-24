import { expect, test } from '@playwright/test'

test('kanvas editor merender proyek contoh dan menyimpan tema gelap/terang di localStorage', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  await page.goto('/editor/contoh')

  const stage = page.getByTestId('cad-canvas')
  await expect(stage).toBeVisible()
  await expect(page.locator('#cad')).toBeVisible()
  await expect(page.locator('#world')).toContainText('FCU-01 · 1300 cfm')
  await expect(page.locator('#world')).toContainText('KANTOR')

  // Default gelap: bg-cad-ground (#14171b)
  await expect(stage).toHaveCSS('background-color', 'rgb(20, 23, 27)')

  const themeBtn = page.getByRole('button', { name: 'Ganti tema kanvas' })
  await expect(themeBtn).toHaveAttribute('aria-pressed', 'false')

  // Beralih ke tema kanvas terang (#f6f7f9)
  await themeBtn.click()
  await expect(themeBtn).toHaveAttribute('aria-pressed', 'true')
  await expect(stage).toHaveCSS('background-color', 'rgb(246, 247, 249)')
  expect(await page.evaluate(() => localStorage.getItem('temandor.theme'))).toBe('light')

  // Reload: tema terang bertahan
  await page.reload()
  await expect(page.getByTestId('cad-canvas')).toHaveCSS('background-color', 'rgb(246, 247, 249)')
  await expect(page.getByRole('button', { name: 'Ganti tema kanvas' })).toHaveAttribute('aria-pressed', 'true')

  // Kembalikan ke gelap
  await page.getByRole('button', { name: 'Ganti tema kanvas' }).click()
  await expect(page.getByTestId('cad-canvas')).toHaveCSS('background-color', 'rgb(20, 23, 27)')
  expect(await page.evaluate(() => localStorage.getItem('temandor.theme'))).toBe('dark')

  expect(errors).toEqual([])
})
