import { expect, test } from '@playwright/test'

test('tema dasar memakai warna paper/ink dan font self-host tanpa CDN Google', async ({ page }) => {
  const externalFontRequests: string[] = []
  page.on('request', (req) => {
    const url = req.url()
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
      externalFontRequests.push(url)
    }
  })

  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'id')

  const styles = await page.evaluate(() => {
    const body = getComputedStyle(document.body)
    const h1 = document.querySelector('h1')
    return {
      bg: body.backgroundColor,
      color: body.color,
      bodyFont: body.fontFamily,
      headingFont: h1 ? getComputedStyle(h1).fontFamily : '',
    }
  })

  expect(styles.bg).toBe('rgb(243, 242, 238)')
  expect(styles.color).toBe('rgb(23, 25, 28)')
  expect(styles.bodyFont).toContain('Barlow')
  expect(styles.headingFont).toContain('Barlow Condensed')
  expect(externalFontRequests).toEqual([])
})

test('halaman /_tema tidak ikut di build produksi', async ({ page }) => {
  const response = await page.goto('/_tema')
  expect(response?.status()).toBe(404)
})
