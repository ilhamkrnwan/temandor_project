<script setup lang="ts">
import {
  BOQ_DISCLAIMER,
  BOQ_ORDER,
  boq,
  boqCSV,
  boqSummary,
  boqText,
  formatBoqQty,
  type BoqCategory,
  type BoqRow,
  type Project,
} from '../../../shared/cad'
import { downloadTextFile, projectSlug } from '../../utils/projectFiles'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  project: Project
}>()

const toast = useToast()

const rows = computed<BoqRow[]>(() => (open.value ? boq(props.project) : []))

const groupedRows = computed<Array<{ category: BoqCategory, items: BoqRow[] }>>(() => (
  BOQ_ORDER
    .map(category => ({
      category,
      items: rows.value.filter(r => r.kat === category),
    }))
    .filter(group => group.items.length > 0)
))

const summary = computed(() => boqSummary(rows.value))

function handleDownloadCsv() {
  if (rows.value.length === 0) return
  const filename = `${projectSlug(props.project.name)}-material.csv`
  downloadTextFile(filename, boqCSV(rows.value), 'text/csv;charset=utf-8')
  toast.add({
    title: `CSV ${filename} diunduh`,
    description: 'Buka dengan Excel atau Google Sheets (pemisah titik koma, koma desimal).',
  })
}

async function handleCopyText() {
  if (rows.value.length === 0) return
  const text = boqText(props.project.name, rows.value)
  try {
    await navigator.clipboard.writeText(text)
    toast.add({
      title: 'Daftar material disalin',
      description: 'Tempel langsung di WhatsApp atau catatan lapangan.',
    })
  }
  catch {
    toast.add({
      title: 'Browser menolak menyalin otomatis',
      description: 'Gunakan tombol Unduh CSV (Excel) sebagai alternatif.',
    })
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Daftar material (BOQ)"
    :description="`Dihitung dari gambar. ${BOQ_DISCLAIMER}`"
    :ui="{ content: 'sm:max-w-[760px]', footer: 'flex-wrap items-center gap-2' }"
  >
    <template #body>
      <div
        data-testid="boq-dialog-body"
        class="space-y-4 text-sm text-ink"
      >
        <p
          v-if="rows.length === 0"
          data-testid="boq-empty"
          class="py-10 text-center text-muted"
        >
          Belum ada duct atau komponen. Gambar dulu, daftar ini terisi sendiri.
        </p>

        <template v-else>
          <section
            v-for="group in groupedRows"
            :key="group.category"
            :data-testid="`boq-group-${group.category.toLowerCase()}`"
            class="space-y-1.5"
          >
            <h3 class="font-condensed text-[11px] font-bold tracking-[0.1em] uppercase text-muted">
              {{ group.category }}
            </h3>
            <div class="overflow-x-auto rounded-[10px] bg-card ring-1 ring-line">
              <table class="w-full border-collapse text-sm">
                <thead class="sr-only">
                  <tr>
                    <th scope="col">
                      Item
                    </th>
                    <th scope="col">
                      Spesifikasi
                    </th>
                    <th scope="col">
                      Jumlah
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, index) in group.items"
                    :key="`${row.item}-${row.spec}-${row.unit}-${index}`"
                    class="border-b border-line last:border-b-0"
                  >
                    <td class="py-2 pl-3 pr-2 text-ink">
                      {{ row.item }}
                    </td>
                    <td class="py-2 px-2 font-mono text-xs text-muted">
                      {{ row.spec || '-' }}
                    </td>
                    <td class="py-2 pl-2 pr-3 w-28 font-mono text-xs font-medium text-right whitespace-nowrap text-ink">
                      {{ formatBoqQty(row) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <p class="rounded-lg bg-paper ring-1 ring-line px-3 py-2 text-xs text-muted leading-relaxed">
            Dihitung langsung dari sketsa. {{ BOQ_DISCLAIMER }} Cek ulang ukuran dan kebutuhan lapangan sebelum belanja.
          </p>
        </template>
      </div>
    </template>

    <template #footer>
      <span
        data-testid="boq-summary"
        class="font-mono text-xs text-muted mr-auto"
      >
        {{ summary.label }}
      </span>
      <button
        type="button"
        class="btn-ghost"
        @click="open = false"
      >
        Tutup
      </button>
      <button
        type="button"
        data-testid="boq-copy-btn"
        class="btn-ghost"
        :disabled="rows.length === 0"
        @click="handleCopyText"
      >
        Salin teks
      </button>
      <button
        type="button"
        data-testid="boq-csv-btn"
        class="btn-primary"
        :disabled="rows.length === 0"
        @click="handleDownloadCsv"
      >
        Unduh CSV (Excel)
      </button>
    </template>
  </UModal>
</template>
