import {
  AI_TOOL_LABELS,
  runTool,
  toolDefs,
  toolReadOnly,
  type AiToolName,
  type Project,
} from '#shared/cad'

export const AI_KEY_STORAGE = 'temandor.ai.key'
export const AI_DEFAULT_MODEL = 'claude-opus-4-6'

export const AI_SYSTEM = `Kamu asisten di Temandor, aplikasi sketsa ducting & ventilasi (HVAC) untuk teknisi lapangan di Indonesia.
Kamu bisa membaca dan mengubah gambar lewat tool. Satuan posisi mm, x ke kanan, y ke bawah.
- Panggil get_project dulu untuk tahu isi gambar; panggil list_types kalau butuh tipe/parameter komponen.
- Setelah mengubah gambar, cek warnings di get_project dan sebutkan yang masih tersisa.
- Ukuran duct (w/h) memakai satuan duct proyek. Jalur duct berbelok: draw_duct (elbow otomatis).
- Jawab singkat dalam bahasa Indonesia sehari-hari. Ini sketsa bantu: ingatkan cek ukuran di lapangan bila relevan.
- Kalau permintaan kurang jelas (mis. ukuran ruangan), pakai nilai wajar dan sebutkan asumsinya.`

export const AI_SUGGESTIONS: readonly string[] = [
  'Cek gambar ini dan jelaskan warning-nya',
  'Tambah ruangan rapat 6x5 m di sebelah kanan, dengan pintu dan 2 diffuser',
  'Sambungkan ujung duct yang masih terbuka',
]

export interface AiToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface AiTextBlock {
  type: 'text'
  text: string
}

export type AiContentBlock = AiTextBlock | AiToolUseBlock | { type: string, [key: string]: unknown }

export interface AiToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
}

export interface AiConversationMessage {
  role: 'user' | 'assistant'
  content: string | AiContentBlock[] | AiToolResultBlock[]
}

export interface AiMessagesResponse {
  content: AiContentBlock[]
  stop_reason: string | null
}

export interface AiMessagesClient {
  createMessage: (params: {
    model: string
    max_tokens: number
    system: string
    tools: ReturnType<typeof toolDefs>
    messages: AiConversationMessage[]
  }) => Promise<AiMessagesResponse>
}

export interface AiToolCallRecord {
  id: string
  name: string
  label: string
  isError: boolean
}

export interface AiToolBatchOutcome {
  results: AiToolResultBlock[]
  records: AiToolCallRecord[]
  changedIds: string[]
  deletedCount: number
  undoMark: number | null
}

export type AiUiEvent
  = | { kind: 'text', text: string }
    | { kind: 'tools', records: AiToolCallRecord[], canUndo: boolean, undoMark: number | null }
    | { kind: 'error', text: string }

export function loadAiApiKey(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(AI_KEY_STORAGE)?.trim() ?? ''
  }
  catch {
    return ''
  }
}

export function saveAiApiKey(apiKey: string): boolean {
  if (typeof window === 'undefined') return false
  const cleaned = apiKey.trim()
  if (!cleaned) return false
  try {
    window.localStorage.setItem(AI_KEY_STORAGE, cleaned)
    return true
  }
  catch {
    return false
  }
}

export function clearAiApiKey(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(AI_KEY_STORAGE)
  }
  catch {
    // Abaikan jika penyimpanan dibatasi browser.
  }
}

/** Muat SDK resmi `@anthropic-ai/sdk` secara lazy dalam mode browser BYOK (hanya ke `api.anthropic.com`). */
export async function createAnthropicBrowserClient(apiKey: string): Promise<AiMessagesClient> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  })
  return {
    async createMessage(params) {
      const response = await client.messages.create({
        model: params.model,
        max_tokens: params.max_tokens,
        system: params.system,
        tools: params.tools as unknown as Parameters<typeof client.messages.create>[0]['tools'],
        messages: params.messages as unknown as Parameters<typeof client.messages.create>[0]['messages'],
      })
      return {
        content: response.content as unknown as AiContentBlock[],
        stop_reason: response.stop_reason,
      }
    },
  }
}

/** Format pesan error SDK Anthropic ke bahasa Indonesia lapangan yang jelas. */
export function formatAiError(err: unknown): string {
  if (err && typeof err === 'object') {
    const status = 'status' in err ? Number((err as { status?: unknown }).status) : NaN
    const name = 'name' in err ? String((err as { name?: unknown }).name) : ''
    const message = 'message' in err ? String((err as { message?: unknown }).message) : ''
    if (status === 401 || name === 'AuthenticationError') {
      return 'Kunci API ditolak oleh Anthropic. Cek atau ganti kuncinya.'
    }
    if (status === 403 || name === 'PermissionDeniedError') {
      return 'Kunci API ini tidak memiliki akses ke model yang dipakai.'
    }
    if (status === 429 || name === 'RateLimitError') {
      return 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.'
    }
    if (name === 'APIConnectionError') {
      return 'Tidak bisa terhubung ke api.anthropic.com. Cek koneksi internet.'
    }
    if (Number.isFinite(status)) {
      return `Server AI error (${status}): ${message || 'permintaan gagal'}`
    }
    if (message) return `Gagal memproses AI: ${message}`
  }
  return 'Gagal menghubungi asisten AI.'
}

/**
 * Jalankan sekumpulan tool dalam satu langkah atomik terhadap `project`:
 * - Bila semua tool read-only (`get_project`, `list_types`), tidak menambah langkah undo.
 * - Bila ada tool pengubah, seluruh batch dijalankan dalam satu `commitDraft()` (= satu undo).
 */
export function executeAiToolBatchOnProject(
  uses: readonly AiToolUseBlock[],
  getProject: () => Project,
  commitDraft: (label: string, mutator: (draft: Project) => void) => boolean,
  getUndoCount: () => number,
): AiToolBatchOutcome {
  const results: AiToolResultBlock[] = []
  const records: AiToolCallRecord[] = []
  const hasMutating = uses.some(u => !toolReadOnly(u.name))

  const runSingle = (target: Project, use: AiToolUseBlock) => {
    const label = AI_TOOL_LABELS[use.name as AiToolName] ?? use.name
    try {
      const output = runTool(target, use.name, use.input ?? {})
      results.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content: JSON.stringify(output),
      })
      records.push({ id: use.id, name: use.name, label, isError: false })
    }
    catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menjalankan tool'
      results.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content: msg,
        is_error: true,
      })
      records.push({ id: use.id, name: use.name, label, isError: true })
    }
  }

  if (!hasMutating) {
    const current = getProject()
    for (const use of uses) runSingle(current, use)
    return { results, records, changedIds: [], deletedCount: 0, undoMark: null }
  }

  const beforeMap = new Map(getProject().nodes.map(n => [n.id, JSON.stringify(n)]))
  const primaryLabel = AI_TOOL_LABELS[uses.find(u => !toolReadOnly(u.name))?.name as AiToolName] ?? 'Langkah AI'

  const committed = commitDraft(`AI: ${primaryLabel}`, (draft) => {
    for (const use of uses) runSingle(draft, use)
  })

  const after = getProject()
  const afterIds = new Set(after.nodes.map(n => n.id))
  const changedIds = after.nodes
    .filter(n => beforeMap.get(n.id) !== JSON.stringify(n))
    .map(n => n.id)
  let deletedCount = 0
  for (const id of beforeMap.keys()) {
    if (!afterIds.has(id)) deletedCount += 1
  }

  return {
    results,
    records,
    changedIds,
    deletedCount,
    undoMark: committed && (changedIds.length > 0 || deletedCount > 0) ? getUndoCount() : null,
  }
}

export interface RunAiTurnOptions {
  client: AiMessagesClient
  conversation: AiConversationMessage[]
  userPrompt: string
  executeBatch: (uses: readonly AiToolUseBlock[]) => AiToolBatchOutcome
  onEvent: (event: AiUiEvent) => void
  onChangedSelection?: (changedIds: string[]) => void
  model?: string
  maxSteps?: number
}

/**
 * Jalankan satu giliran percakapan AI beserta loop `tool_use` -> `tool_result`
 * hingga model selesai memberikan jawaban teks atau mencapai batas langkah.
 */
export async function runAiTurn(options: RunAiTurnOptions): Promise<void> {
  const prompt = options.userPrompt.trim()
  if (!prompt) return

  const model = options.model ?? AI_DEFAULT_MODEL
  const maxSteps = options.maxSteps ?? 15
  const tools = toolDefs()

  options.conversation.push({ role: 'user', content: prompt })

  try {
    for (let step = 0; step < maxSteps; step++) {
      const response = await options.client.createMessage({
        model,
        max_tokens: 8192,
        system: AI_SYSTEM,
        tools,
        messages: options.conversation,
      })

      options.conversation.push({ role: 'assistant', content: response.content })

      for (const block of response.content) {
        if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
          options.onEvent({ kind: 'text', text: block.text.trim() })
        }
      }

      if (response.stop_reason === 'refusal') {
        options.onEvent({ kind: 'text', text: 'Maaf, permintaan ini tidak bisa diproses.' })
        break
      }
      if (response.stop_reason === 'pause_turn') {
        continue
      }

      const toolUses = response.content.filter(
        (b): b is AiToolUseBlock => b.type === 'tool_use' && typeof b.id === 'string' && typeof b.name === 'string',
      )

      if (toolUses.length === 0) {
        if (response.stop_reason === 'max_tokens') {
          options.onEvent({ kind: 'text', text: 'Jawaban terpotong karena terlalu panjang.' })
        }
        break
      }

      const outcome = options.executeBatch(toolUses)
      if (outcome.changedIds.length > 0) {
        options.onChangedSelection?.(outcome.changedIds)
      }

      options.onEvent({
        kind: 'tools',
        records: outcome.records,
        canUndo: outcome.undoMark !== null,
        undoMark: outcome.undoMark,
      })

      options.conversation.push({
        role: 'user',
        content: outcome.results,
      })
    }
  }
  catch (err) {
    options.onEvent({ kind: 'error', text: formatAiError(err) })
    const last = options.conversation[options.conversation.length - 1]
    if (last && last.role === 'user' && typeof last.content === 'string') {
      options.conversation.pop()
    }
  }
}
