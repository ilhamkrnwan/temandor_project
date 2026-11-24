import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

test('generate menghasilkan HTML statis untuk / dan /docs serta fallback 200.html', () => {
  const out = resolve(process.cwd(), '.output/public')
  expect(existsSync(resolve(out, 'index.html'))).toBe(true)
  expect(existsSync(resolve(out, 'docs/index.html'))).toBe(true)
  expect(existsSync(resolve(out, '200.html'))).toBe(true)
  expect(existsSync(resolve(out, '404.html'))).toBe(true)
  expect(existsSync(resolve(out, '_redirects'))).toBe(true)
})

const routes = [
  {
    path: '/',
    heading: /Sketsa ducting rapi/i,
    titlePart: 'Temandor',
    hasDefaultHeader: false,
  },
  {
    path: '/proyek',
    heading: 'Proyek',
    titlePart: 'Proyek',
    hasDefaultHeader: true,
  },
  {
    path: '/editor/contoh',
    heading: 'Ruang Kerja Editor',
    titlePart: 'Editor (contoh)',
    hasDefaultHeader: false,
  },
  {
    path: '/docs',
    heading: 'Dokumentasi',
    titlePart: 'Dokumentasi',
    hasDefaultHeader: true,
  },
]

for (const route of routes) {
  test(`rute ${route.path} terbuka tanpa error konsol dan memakai layout sesuai`, async ({ page }) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error')
        errors.push(message.text())
    })
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    const response = await page.goto(route.path)
    expect(response?.status()).toBe(200)

    await expect(page.locator('html')).toHaveAttribute('lang', 'id')
    await expect(page).toHaveTitle(new RegExp(route.titlePart.replace(/[()]/g, '\\$&')))
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/)
    await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible()

    const defaultNav = page.getByRole('navigation', { name: 'Navigasi utama' })
    if (route.hasDefaultHeader) {
      await expect(defaultNav).toBeVisible()
    }
    else {
      await expect(defaultNav).toHaveCount(0)
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    expect(errors).toEqual([])
  })
}

test('navigasi antar rute dan refresh langsung di /editor/contoh berjalan mulus', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  await page.goto('/')
  await page.getByTestId('landing-open-app').click()
  await expect(page).toHaveURL(/\/proyek$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Proyek' })).toBeVisible()

  await page.locator('a[href="/editor/contoh"]').first().click()
  await expect(page).toHaveURL(/\/editor\/contoh$/)
  await expect(page.getByText('EDITOR · ID contoh')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Ruang Kerja Editor' })).toBeVisible()
  await expect(page.getByText('EDITOR · ID contoh')).toBeVisible()

  await page.getByRole('link', { name: 'Kembali ke proyek' }).click()
  await expect(page).toHaveURL(/\/proyek$/)

  await page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: 'Docs' }).click()
  await expect(page).toHaveURL(/\/docs$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Dokumentasi' })).toBeVisible()

  expect(errors).toEqual([])
})

test('halaman tidak ditemukan dan proyek /editor/tidak-ada menampilkan error.vue 404 yang ramah', async ({ page }) => {
  const response = await page.goto('/jalur-tidak-ada')
  expect(response?.status()).toBe(404)

  await expect(page.locator('html')).toHaveAttribute('lang', 'id')
  await expect(page.getByRole('heading', { level: 1, name: 'Jalurnya putus di sini' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ke daftar proyek' })).toHaveAttribute('href', '/proyek')
  await expect(page.getByRole('link', { name: 'Buka dokumentasi' })).toHaveAttribute('href', '/docs')

  // Proyek dengan ID tidak ditemukan di browser -> menampilkan 404 ramah dengan tombol kembali ke /proyek
  await page.goto('/editor/tidak-ada')
  await expect(page.getByRole('heading', { level: 1, name: 'Jalurnya putus di sini' })).toBeVisible()
  await expect(page.getByText(/tidak-ada/)).toBeVisible()
  await page.getByRole('link', { name: 'Ke daftar proyek' }).click()
  await expect(page).toHaveURL(/\/proyek$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Proyek' })).toBeVisible()
})
