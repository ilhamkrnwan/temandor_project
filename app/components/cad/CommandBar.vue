<script setup lang="ts">
const props = defineProps<{
  hint: string
}>()

const emit = defineEmits<{
  submit: [raw: string]
}>()

const inputText = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    const value = inputText.value
    inputText.value = ''
    emit('submit', value)
    return
  }
  if (e.key === 'Escape') {
    inputText.value = ''
    inputRef.value?.blur()
  }
}

defineExpose({
  focus() {
    inputRef.value?.focus()
  },
  blur() {
    inputRef.value?.blur()
  },
  startTyping(char: string) {
    inputText.value = char
    const el = inputRef.value
    if (!el) return
    el.value = char
    el.focus()
    el.setSelectionRange(char.length, char.length)
  },
})
</script>

<template>
  <div class="h-9 shrink-0 flex items-center gap-2 px-3 bg-[#1d2126] border-t border-black text-xs font-mono">
    <span
      class="text-hazard select-none"
      aria-hidden="true"
    >›</span>
    <span
      v-if="props.hint"
      data-testid="cmd-hint"
      class="text-card/85 truncate max-w-[55%]"
    >
      {{ props.hint }}
    </span>
    <input
      id="cmd"
      ref="inputRef"
      v-model="inputText"
      type="text"
      autocomplete="off"
      spellcheck="false"
      aria-label="Baris perintah"
      placeholder="perintah / angka..."
      class="min-w-[6rem] flex-1 bg-transparent outline-none text-card placeholder:text-card/55"
      @keydown="onKeydown"
    >
  </div>
</template>
