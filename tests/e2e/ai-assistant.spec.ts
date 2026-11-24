import { expect, test } from '@playwright/test'

test('asisten AI BYOK Claude (M6-02): loop tool menambah komponen, pilih otomatis, urungkan langkah, dan kunci hanya dikirim ke api.anthropic.com', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })

  const TEST_API_KEY = 'sk-ant-test-temandor-key-999'
  const requestsContainingKey: string[] = []
  let anthropicCallCount = 0

  // Pantau SEMUA permintaan jaringan keluar: pastikan kunci API tidak pernah bocor ke host selain api.anthropic.com
  page.on('request', (req) => {
    const headersJson = JSON.stringify(req.headers())
    const body = req.postData() ?? ''
    if (headersJson.includes(TEST_API_KEY) || body.includes(TEST_API_KEY) || req.url().includes(TEST_API_KEY)) {
      requestsContainingKey.push(new URL(req.url()).host)
    }
  })

  // Mock endpoint resmi Anthropic Messages API
  await page.route('https://api.anthropic.com/v1/messages*', async (route) => {
    anthropicCallCount += 1
    if (anthropicCallCount === 1) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'msg_test_1',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-4-6',
          stop_reason: 'tool_use',
          content: [
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'add_nodes',
              input: {
                nodes: [
                  { type: 'diffuser', x: 3500, y: 2500, props: { flow: 250 } },
                ],
              },
            },
          ],
          usage: { input_tokens: 100, output_tokens: 40 },
        }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'msg_test_2',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-4-6',
        stop_reason: 'end_turn',
        content: [
          {
            type: 'text',
            text: 'Diffuser 250 cfm sudah ditambahkan ke ruangan.',
          },
        ],
        usage: { input_tokens: 140, output_tokens: 25 },
      }),
    })
  })

  await page.goto('/editor/contoh')
  const svg = page.locator('#cad')
  await expect(svg).toBeVisible()
  const initialDiffCount = await svg.locator('[data-layer="diff"] [data-id]').count()

  // 1. Buka jendela AI via tombol melayang Tanya AI dan simpan kunci API Claude
  await page.getByTestId('ai-fab').click()
  await expect(page.getByTestId('ai-window')).toBeVisible()
  await expect(page.getByTestId('ai-key-box')).toBeVisible()

  await page.getByTestId('ai-key-input').fill(TEST_API_KEY)
  await page.getByTestId('ai-key-save').click()
  await expect(page.getByTestId('ai-status-badge')).toContainText('Claude')

  // 2. Kirim permintaan -> mock Anthropic memanggil tool add_nodes lalu membalas teks
  await page.getByTestId('ai-input').fill('Tambah 1 diffuser 250 cfm')
  await page.getByTestId('ai-send').click()

  await expect(page.getByTestId('ai-tool-bubble')).toContainText('Menambah komponen')
  await expect(page.getByTestId('ai-bot-msg')).toContainText('Diffuser 250 cfm sudah ditambahkan')
  await expect(svg.locator('[data-layer="diff"] [data-id]')).toHaveCount(initialDiffCount + 1)
  await expect(page.getByTestId('selection-count')).toContainText('1 dipilih')

  // 3. Klik "Urungkan langkah ini" -> diffuser hasil AI langsung terhapus dalam 1 langkah
  const undoStepBtn = page.getByTestId('ai-undo-step')
  await expect(undoStepBtn).toBeVisible()
  await undoStepBtn.click()
  await expect(undoStepBtn).toHaveText('Diurungkan')
  await expect(svg.locator('[data-layer="diff"] [data-id]')).toHaveCount(initialDiffCount)

  // 4. Kunci API HANYA pernah dikirim ke api.anthropic.com (tidak pernah ke host lain)
  expect(anthropicCallCount).toBe(2)
  expect(requestsContainingKey.length).toBeGreaterThan(0)
  expect(requestsContainingKey.every(host => host === 'api.anthropic.com')).toBe(true)

  // Tutup dengan Escape
  await page.getByTestId('ai-close').click()
  await expect(page.getByTestId('ai-window')).toHaveCount(0)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  expect(errors).toEqual([])
})
