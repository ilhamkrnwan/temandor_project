import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const AUDIT_ROUTES = [
  { path: '/', label: 'Landing /', waitSelector: 'h1' },
  { path: '/proyek', label: 'Daftar proyek /proyek', waitSelector: '[data-testid="project-card"]' },
  { path: '/editor/contoh', label: 'Editor /editor/contoh', waitSelector: '#cad' },
  { path: '/docs', label: 'Dokumentasi /docs', waitSelector: '[data-testid="docs-layer-table"]' },
] as const

for (const route of AUDIT_ROUTES) {
  test(`aksesibilitas WCAG AA (axe-core) tanpa pelanggaran serious/critical di ${route.label}`, async ({ page }) => {
    await page.goto(route.path)
    await expect(page.locator(route.waitSelector).first()).toBeVisible()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const seriousOrCritical = results.violations.filter(
      v => v.impact === 'serious' || v.impact === 'critical',
    )

    expect(
      seriousOrCritical.map(v => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        targets: v.nodes.map(n => n.target),
      })),
      `Pelanggaran axe serious/critical ditemukan di ${route.path}`,
    ).toEqual([])

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
}

test('aksesibilitas editor: kanvas keyboard-operable (Tab/Escape) dan target sentuh >= 24px', async ({ page }) => {
  await page.goto('/editor/contoh')
  const svg = page.locator('#cad')
  await expect(svg).toBeVisible()
  await expect(svg).toHaveAttribute('tabindex', '0')

  // Fokus keyboard ke kanvas -> Tab memilih komponen -> Escape membatalkan pilihan
  await svg.focus()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('selection-count')).toContainText('1 dipilih')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('selection-count')).toHaveCount(0)

  // Semua tombol terlihat di header & rail memiliki target sentuh minimal 24x24 px (WCAG 2.2 AA)
  const smallButtons = await page.evaluate(() => {
    const selectors = 'header button, header a, #rail button'
    const bad: string[] = []
    for (const el of document.querySelectorAll(selectors)) {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      if (rect.width < 24 || rect.height < 24) {
        bad.push(`${el.tagName}:${el.textContent?.trim() || el.getAttribute('aria-label') || '?'} (${Math.round(rect.width)}x${Math.round(rect.height)})`)
      }
    }
    return bad
  })
  expect(smallButtons).toEqual([])
})
