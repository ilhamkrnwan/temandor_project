<script setup lang="ts">
import type { Project } from '#shared/cad'
import {
  AI_SUGGESTIONS,
  clearAiApiKey,
  createAnthropicBrowserClient,
  executeAiToolBatchOnProject,
  loadAiApiKey,
  runAiTurn,
  saveAiApiKey,
  type AiConversationMessage,
  type AiMessagesClient,
  type AiToolCallRecord,
} from '../../utils/aiAssistant'

interface ChatBubble {
  id: number
  kind: 'user' | 'bot' | 'tools' | 'error'
  text?: string
  records?: AiToolCallRecord[]
  canUndo?: boolean
  undoMark?: number | null
  undone?: boolean
}

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  getProject: () => Project
  commitDraft: (label: string, mutator: (draft: Project) => void) => boolean
  getUndoCount: () => number
  undoLast: () => boolean
  focusNodes: (ids: string[]) => void
}>()

const toast = useToast()

const apiKey = ref('')
const keyDraft = ref('')
const showKeySettings = ref(false)
const promptText = ref('')
const busy = ref(false)
const bubbles = ref<ChatBubble[]>([])
const logEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)
const keyInputEl = ref<HTMLInputElement | null>(null)

let nextBubbleId = 1
let conversation: AiConversationMessage[] = []
let cachedClient: AiMessagesClient | null = null

const hasKey = computed(() => apiKey.value.length > 0)

function scrollLogToBottom() {
  void nextTick(() => {
    if (logEl.value) {
      logEl.value.scrollTop = logEl.value.scrollHeight
    }
  })
}

function handleSaveKey() {
  const cleaned = keyDraft.value.trim()
  if (!cleaned) {
    toast.add({ title: 'Masukkan kunci API Anthropic Claude terlebih dulu' })
    return
  }
  saveAiApiKey(cleaned)
  apiKey.value = cleaned
  keyDraft.value = ''
  cachedClient = null
  showKeySettings.value = false
  toast.add({ title: 'Kunci API Claude tersimpan di browser ini' })
  void nextTick(() => inputEl.value?.focus())
}

function handleClearKey() {
  clearAiApiKey()
  apiKey.value = ''
  keyDraft.value = ''
  cachedClient = null
  showKeySettings.value = true
  toast.add({ title: 'Kunci API dihapus dari browser ini' })
}

function handleClearChat() {
  conversation = []
  bubbles.value = []
}

function handleUndoStep(bubble: ChatBubble) {
  if (bubble.undone || bubble.undoMark == null) return
  if (props.getUndoCount() !== bubble.undoMark) {
    toast.add({
      title: 'Sudah ada perubahan lain sesudahnya',
      description: 'Gunakan Ctrl+Z untuk mengurungkan perubahan satu per satu.',
    })
    return
  }
  if (props.undoLast()) {
    bubble.undone = true
  }
}

async function sendPrompt(raw: string) {
  const text = raw.trim()
  if (!text || busy.value) return
  if (!hasKey.value) {
    showKeySettings.value = true
    toast.add({ title: 'Hubungkan kunci API Claude dulu untuk memakai Asisten AI' })
    void nextTick(() => keyInputEl.value?.focus())
    return
  }

  promptText.value = ''
  busy.value = true
  bubbles.value.push({ id: nextBubbleId++, kind: 'user', text })
  scrollLogToBottom()

  try {
    if (!cachedClient) {
      cachedClient = await createAnthropicBrowserClient(apiKey.value)
    }

    await runAiTurn({
      client: cachedClient,
      conversation,
      userPrompt: text,
      executeBatch: uses => executeAiToolBatchOnProject(
        uses,
        props.getProject,
        props.commitDraft,
        props.getUndoCount,
      ),
      onChangedSelection: (ids) => {
        props.focusNodes(ids)
      },
      onEvent: (event) => {
        if (event.kind === 'text') {
          bubbles.value.push({ id: nextBubbleId++, kind: 'bot', text: event.text })
        }
        else if (event.kind === 'tools') {
          bubbles.value.push({
            id: nextBubbleId++,
            kind: 'tools',
            records: event.records,
            canUndo: event.canUndo,
            undoMark: event.undoMark,
            undone: false,
          })
        }
        else {
          bubbles.value.push({ id: nextBubbleId++, kind: 'error', text: event.text })
        }
        scrollLogToBottom()
      },
    })
  }
  finally {
    busy.value = false
    scrollLogToBottom()
  }
}

function onInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    void sendPrompt(promptText.value)
  }
  else if (e.key === 'Escape') {
    e.stopPropagation()
    open.value = false
  }
}

function onWindowKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    e.stopPropagation()
    open.value = false
  }
}

watch(open, (isOpen) => {
  if (!isOpen) return
  apiKey.value = loadAiApiKey()
  showKeySettings.value = !apiKey.value
  void nextTick(() => {
    if (hasKey.value) inputEl.value?.focus()
    else keyInputEl.value?.focus()
  })
})

onMounted(() => {
  apiKey.value = loadAiApiKey()
  window.addEventListener('keydown', onWindowKeydown, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown, true)
})
</script>

<template>
  <!-- Tombol pil melayang Tanya AI di bawah tengah kanvas -->
  <button
    v-if="!open"
    type="button"
    data-testid="ai-fab"
    aria-haspopup="dialog"
    aria-expanded="false"
    title="Tanya Asisten AI (Ctrl+K)"
    class="absolute z-20 bottom-3 left-1/2 -translate-x-1/2 max-sm:left-3 max-sm:translate-x-0 inline-flex items-center gap-2 h-10 px-4 rounded-full bg-ink text-card text-[13px] font-semibold shadow-[var(--shadow-bar)] hover:ring-3 hover:ring-hazard/40 focus-visible:outline-2 focus-visible:outline-hazard focus-visible:outline-offset-2 transition-shadow"
    @click="open = true"
  >
    <UIcon
      name="i-lucide-sparkles"
      class="size-4 text-hazard shrink-0"
      aria-hidden="true"
    />
    <span>Tanya AI</span>
    <kbd class="hidden sm:inline-block px-1.5 py-0.5 rounded bg-white/12 font-mono text-[10px] text-card/85">Ctrl+K</kbd>
  </button>

  <!-- Jendela Asisten AI melayang (kanan desktop, lembar bawah HP) -->
  <section
    v-if="open"
    data-testid="ai-window"
    role="dialog"
    aria-label="Asisten AI Temandor"
    class="fixed z-30 right-3 top-14 bottom-20 w-[min(24rem,calc(100%-1.5rem))] max-sm:top-auto max-sm:inset-x-2 max-sm:bottom-16 max-sm:w-auto max-sm:h-[min(72dvh,32rem)] flex flex-col rounded-[16px] bg-panel text-ink shadow-[0_24px_60px_-16px_rgb(0_0_0/0.6),0_0_0_1px_rgb(0_0_0/0.08)] overflow-hidden"
    @keydown.escape.stop="open = false"
  >
    <header class="flex items-center gap-2 px-4 py-3 border-b border-line bg-panel shrink-0">
      <UIcon
        name="i-lucide-sparkles"
        class="size-4 text-ink shrink-0"
        aria-hidden="true"
      />
      <h2 class="font-cond text-[15px] font-bold tracking-[0.08em] uppercase text-ink">
        Asisten AI
      </h2>
      <span
        data-testid="ai-status-badge"
        class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-card ring-1 ring-line text-muted"
      >
        <span
          class="size-1.5 rounded-full"
          :class="hasKey ? 'bg-done-green' : 'bg-muted'"
          aria-hidden="true"
        />
        {{ hasKey ? 'Claude' : 'Belum terhubung' }}
      </span>
      <button
        type="button"
        data-testid="ai-settings-btn"
        class="ml-auto size-8 grid place-items-center rounded-[6px] text-muted hover:text-ink hover:bg-hover-tint"
        title="Pengaturan kunci API Claude"
        aria-label="Pengaturan kunci API Claude"
        @click="showKeySettings = !showKeySettings"
      >
        <UIcon
          name="i-lucide-key-round"
          class="size-4"
          aria-hidden="true"
        />
      </button>
      <button
        v-if="bubbles.length > 0"
        type="button"
        data-testid="ai-clear-chat"
        class="size-8 grid place-items-center rounded-[6px] text-muted hover:text-ink hover:bg-hover-tint"
        title="Bersihkan percakapan"
        aria-label="Bersihkan percakapan"
        @click="handleClearChat"
      >
        <UIcon
          name="i-lucide-rotate-ccw"
          class="size-4"
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        data-testid="ai-close"
        class="size-8 grid place-items-center rounded-[6px] text-muted hover:text-ink hover:bg-hover-tint"
        title="Tutup Asisten AI (Esc)"
        aria-label="Tutup Asisten AI"
        @click="open = false"
      >
        <UIcon
          name="i-lucide-x"
          class="size-4"
          aria-hidden="true"
        />
      </button>
    </header>

    <!-- Pengaturan kunci API Claude (minimal, BYOK, tanpa provider mock) -->
    <div
      v-if="showKeySettings || !hasKey"
      data-testid="ai-key-box"
      class="px-4 py-3 border-b border-line bg-paper space-y-2.5 text-xs shrink-0"
    >
      <p class="text-ink font-semibold">
        Hubungkan kunci API Anthropic Claude (BYOK)
      </p>
      <p class="text-muted leading-relaxed">
        Kunci disimpan lokal di browser ini saja dan <strong>hanya dikirim langsung ke <code class="font-mono text-ink">api.anthropic.com</code></strong>.
      </p>
      <form
        class="flex gap-2"
        @submit.prevent="handleSaveKey"
      >
        <input
          ref="keyInputEl"
          v-model="keyDraft"
          data-testid="ai-key-input"
          type="password"
          autocomplete="off"
          :placeholder="hasKey ? 'Ganti kunci sk-ant-...' : 'sk-ant-...'"
          aria-label="Kunci API Anthropic Claude"
          class="field flex-1 font-mono text-xs"
        >
        <button
          type="submit"
          data-testid="ai-key-save"
          class="btn-primary shrink-0"
        >
          Hubungkan
        </button>
      </form>
      <div
        v-if="hasKey"
        class="flex items-center justify-between pt-0.5"
      >
        <span class="text-muted">Kunci Claude aktif di browser ini.</span>
        <button
          type="button"
          data-testid="ai-key-clear"
          class="text-danger font-semibold hover:underline"
          @click="handleClearKey"
        >
          Hapus kunci
        </button>
      </div>
    </div>

    <!-- Riwayat pesan -->
    <div
      ref="logEl"
      data-testid="ai-log"
      class="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 text-sm"
    >
      <div
        v-if="bubbles.length === 0"
        class="space-y-2.5 py-2"
      >
        <p class="font-cond text-xl font-bold leading-tight text-ink">
          Mau digambarkan apa?
        </p>
        <p class="text-xs text-muted leading-relaxed">
          AI bisa membaca gambar, menambah komponen, menggambar duct dengan elbow otomatis, atau mengecek warning. Tiap langkah bisa di-undo.
        </p>
        <div class="space-y-1.5 pt-1">
          <button
            v-for="sug in AI_SUGGESTIONS"
            :key="sug"
            type="button"
            class="w-full text-left rounded-[8px] bg-card ring-1 ring-line px-3 py-2 text-xs text-ink hover:ring-line-strong hover:shadow-[var(--shadow-card-hover)] transition-shadow"
            @click="sendPrompt(sug)"
          >
            {{ sug }}
          </button>
        </div>
      </div>

      <template
        v-for="bubble in bubbles"
        :key="bubble.id"
      >
        <div
          v-if="bubble.kind === 'user'"
          class="ml-auto max-w-[85%] rounded-[12px] rounded-br-[4px] bg-ink text-card px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap"
        >
          {{ bubble.text }}
        </div>

        <div
          v-else-if="bubble.kind === 'bot'"
          data-testid="ai-bot-msg"
          class="max-w-[92%] rounded-[12px] rounded-bl-[4px] bg-card ring-1 ring-line px-3 py-2 text-[13px] text-ink leading-relaxed whitespace-pre-wrap"
        >
          {{ bubble.text }}
        </div>

        <div
          v-else-if="bubble.kind === 'error'"
          data-testid="ai-err-msg"
          class="rounded-[10px] bg-error-wash ring-1 ring-red-200 px-3 py-2 text-xs text-error-ink leading-relaxed"
        >
          {{ bubble.text }}
        </div>

        <div
          v-else-if="bubble.kind === 'tools'"
          data-testid="ai-tool-bubble"
          class="flex flex-wrap items-center gap-1.5"
        >
          <span
            v-for="rec in bubble.records"
            :key="rec.id"
            class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
            :class="rec.isError ? 'bg-error-wash text-error-ink ring-1 ring-red-200' : 'bg-hazard/30 text-ink'"
          >
            <UIcon
              :name="rec.isError ? 'i-lucide-alert-circle' : 'i-lucide-check'"
              class="size-3 shrink-0"
              aria-hidden="true"
            />
            <span>{{ rec.label }}{{ rec.isError ? ' - gagal' : '' }}</span>
          </span>

          <button
            v-if="bubble.canUndo"
            type="button"
            data-testid="ai-undo-step"
            class="btn-ghost h-6! px-2.5! text-xs! rounded-full!"
            :disabled="bubble.undone"
            @click="handleUndoStep(bubble)"
          >
            {{ bubble.undone ? 'Diurungkan' : 'Urungkan langkah ini' }}
          </button>
        </div>
      </template>

      <div
        v-if="busy"
        data-testid="ai-busy"
        class="inline-flex items-center gap-1 rounded-[12px] bg-card ring-1 ring-line px-3 py-2"
        aria-label="Asisten AI sedang memproses"
      >
        <span class="size-1.5 rounded-full bg-muted animate-pulse" />
        <span class="size-1.5 rounded-full bg-muted animate-pulse [animation-delay:150ms]" />
        <span class="size-1.5 rounded-full bg-muted animate-pulse [animation-delay:300ms]" />
      </div>
    </div>

    <!-- Form kirim pesan -->
    <form
      v-if="hasKey"
      class="p-3 border-t border-line bg-panel flex items-end gap-2 shrink-0"
      @submit.prevent="sendPrompt(promptText)"
    >
      <textarea
        ref="inputEl"
        v-model="promptText"
        data-testid="ai-input"
        rows="1"
        placeholder="Minta AI menggambar atau mengecek..."
        aria-label="Pesan untuk Asisten AI"
        class="flex-1 min-h-9 max-h-24 resize-none rounded-[10px] bg-card ring-1 ring-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink"
        @keydown="onInputKeydown"
      />
      <button
        type="submit"
        data-testid="ai-send"
        class="btn-primary h-9! px-3! shrink-0"
        :disabled="busy || !promptText.trim()"
      >
        <UIcon
          name="i-lucide-send"
          class="size-4"
          aria-hidden="true"
        />
        <span class="sr-only">Kirim pesan</span>
      </button>
    </form>
  </section>
</template>
