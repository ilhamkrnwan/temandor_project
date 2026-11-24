<script setup lang="ts">
import {
  COMMAND_REFERENCE,
  SHORTCUTS,
  SHORTCUT_SECTIONS,
  type ShortcutDef,
  type ShortcutSection,
} from '../../../shared/cad'

const open = defineModel<boolean>('open', { default: false })

const grouped = computed<Array<{ section: ShortcutSection, items: ShortcutDef[] }>>(() => (
  SHORTCUT_SECTIONS.map(section => ({
    section,
    items: SHORTCUTS.filter(item => item.section === section),
  }))
))
</script>

<template>
  <UModal
    v-model:open="open"
    title="Pintasan keyboard"
    description="Semua pintasan dibaca langsung dari satu tabel pintasan editor."
    :ui="{ content: 'w-[calc(100vw-2rem)] max-w-[740px]' }"
  >
    <template #body>
      <div
        data-testid="shortcuts-dialog-body"
        class="grid sm:grid-cols-2 gap-6 max-h-[65vh] overflow-y-auto pr-1 text-[13px]"
      >
        <section
          v-for="group in grouped"
          :key="group.section"
          class="space-y-2"
        >
          <h3 class="font-cond font-bold text-xs tracking-[0.1em] uppercase text-muted">
            {{ group.section }}
          </h3>
          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 items-center">
            <template
              v-for="item in group.items"
              :key="item.id"
            >
              <dt
                :data-shortcut-id="item.id"
                class="flex items-center gap-1 whitespace-nowrap"
              >
                <UKbd
                  v-for="(k, idx) in item.keys"
                  :key="`${item.id}-${idx}`"
                  :value="k"
                />
              </dt>
              <dd class="text-ink">
                {{ item.label }}
              </dd>
            </template>
          </dl>
        </section>

        <section class="space-y-2">
          <h3 class="font-cond font-bold text-xs tracking-[0.1em] uppercase text-muted">
            Saat menggambar
          </h3>
          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 items-center">
            <dt class="flex items-center gap-1 whitespace-nowrap text-xs text-muted">
              angka <UKbd value="Enter" />
            </dt>
            <dd class="text-ink">
              Panjang duct (mm)
            </dd>
            <dt class="flex items-center gap-1 whitespace-nowrap text-xs text-muted">
              <UKbd value="6x4" /> <UKbd value="Enter" />
            </dt>
            <dd class="text-ink">
              Ukuran ruangan (m)
            </dd>
            <dt class="flex items-center gap-1 whitespace-nowrap">
              <UKbd value="Shift" />
            </dt>
            <dd class="text-ink">
              Balik ortho sementara
            </dd>
            <dt class="flex items-center gap-1 whitespace-nowrap text-xs text-muted">
              <UKbd value="Tab" /> di kanvas
            </dt>
            <dd class="text-ink">
              Pilih komponen berikutnya
            </dd>
          </dl>
        </section>

        <section class="sm:col-span-2 space-y-2 pt-2 border-t border-line">
          <h3 class="font-cond font-bold text-xs tracking-[0.1em] uppercase text-muted">
            Baris perintah
          </h3>
          <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 items-center">
            <div
              v-for="item in COMMAND_REFERENCE"
              :key="item.cmd"
              :data-command-ref="item.cmd"
              class="flex items-center gap-2"
            >
              <dt class="shrink-0">
                <UKbd :value="item.cmd" />
              </dt>
              <dd class="text-ink truncate">
                {{ item.label }}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </template>
  </UModal>
</template>
