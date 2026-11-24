import { expect, test } from '@playwright/test'

test('beranda terbuka tanpa error konsol', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Temandor' })).toBeVisible()
  expect(errors).toEqual([])
})
