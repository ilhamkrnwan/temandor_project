<script setup lang="ts">
import type { ValidationWarning } from '../../../shared/cad'

const props = defineProps<{
  open: boolean
  warnings: readonly ValidationWarning[]
}>()

const emit = defineEmits<{
  close: []
  select: [warning: ValidationWarning]
}>()
</script>

<template>
  <section
    v-if="props.open"
    id="warn-drawer"
    data-testid="warn-drawer"
    aria-label="Warning validasi"
    class="warn-drawer absolute left-3 right-3 bottom-14 sm:right-auto sm:w-96 z-25 bg-panel text-ink rounded-xl shadow-[0_16px_40px_-12px_rgb(0_0_0/0.5),0_0_0_1px_rgb(0_0_0/0.08)] overflow-hidden"
    @pointerdown.stop
    @contextmenu.stop
  >
    <header class="flex items-center gap-2 px-4 py-2.5 border-b border-line">
      <span
        class="size-2 rounded-full shrink-0"
        :class="props.warnings.length > 0 ? 'bg-warn-red' : 'bg-done-green'"
        aria-hidden="true"
      />
      <strong class="font-cond text-base tracking-wide uppercase text-ink">
        {{ props.warnings.length }} WARNING
      </strong>
      <span class="text-xs text-muted truncate">
        tidak menghalangi simpan / export
      </span>
      <button
        id="warn-close"
        type="button"
        data-testid="warn-close"
        class="ml-auto panel-x grid shrink-0"
        title="Tutup daftar warning"
        aria-label="Tutup daftar warning"
        @click="emit('close')"
      >
        <UIcon
          name="i-lucide-x"
          class="size-4"
          aria-hidden="true"
        />
      </button>
    </header>

    <ul
      id="warn-list"
      data-testid="warn-list"
      class="divide-y divide-line max-h-[40vh] overflow-y-auto"
    >
      <li
        v-for="(w, idx) in props.warnings"
        :key="`${idx}-${w.id}-${w.kind}`"
      >
        <button
          type="button"
          class="warn-item"
          data-testid="warn-item"
          :data-warn-kind="w.kind"
          @click="emit('select', w)"
        >
          <span
            class="shrink-0 grid place-items-center size-6 rounded-full bg-red-100 text-danger font-bold text-xs"
            aria-hidden="true"
          >!</span>
          <span class="min-w-0 flex-1">
            <strong class="block text-[13px] font-semibold text-ink">{{ w.msg }}</strong>
            <span class="block text-muted text-xs mt-0.5 leading-snug">{{ w.detail }}</span>
            <span class="block font-mono text-[11px] text-muted mt-1">
              X {{ Math.round(w.pos[0]) }} · Y {{ Math.round(-w.pos[1]) }}
            </span>
          </span>
          <span class="text-xs font-semibold text-ink self-center shrink-0">Lihat →</span>
        </button>
      </li>

      <li
        v-if="props.warnings.length === 0"
        data-testid="warn-empty"
        class="px-4 py-6 text-center text-sm text-muted"
      >
        Tidak ada masalah. Gambar siap di-export.
      </li>
    </ul>
  </section>
</template>
