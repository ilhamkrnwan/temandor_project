<script setup lang="ts">
import {
  componentOf,
  connect,
  demoProject,
  formatPropNumber,
  newProject,
  parseDecimalInput,
  validate,
  type Project,
  type System,
  type Unit,
} from '../../shared/cad'
import {
  downloadTextFile,
  formatRelativeTime,
  parseImportedProjectJson,
  projectSlug,
  projectThumbDataUrl,
} from '../utils/projectFiles'
import { indexedDbProjectStorage } from '../utils/projectStorage'

const SEEDED_STORAGE_KEY = 'temandor.seeded'
const DEMO_PROJECT_ID = 'contoh'

const toast = useToast()
const route = useRoute()
const router = useRouter()

interface ProjectCardItem {
  project: Project
  thumbUrl: string
  warningCount: number
  systems: System[]
  updatedLabel: string
}

const projects = ref<Project[]>([])
const loading = ref(true)
const searchQuery = ref('')

// Modal proyek baru
const newModalOpen = ref(false)
const newName = ref('')
const newUnit = ref<Unit>('inch')
const newScale = ref<'1:50' | '1:100' | '1:200'>('1:100')
const newLengthM = ref('9')
const newWidthM = ref('6')
const newFormError = ref<string | null>(null)
const creatingProject = ref(false)

// Modal konfirmasi hapus
const deleteTarget = ref<Project | null>(null)
const deleteModalOpen = computed({
  get: () => deleteTarget.value !== null,
  set: (open: boolean) => {
    if (!open) deleteTarget.value = null
  },
})

const fileInputRef = ref<HTMLInputElement | null>(null)

const projectCards = computed<ProjectCardItem[]>(() => {
  return projects.value.map((project) => {
    const cn = connect(project)
    const warningCount = validate(project, cn).length
    const systems: System[] = (['SA', 'EA'] as const).filter(sys =>
      project.nodes.some(n => 'sys' in n && n.sys === sys && componentOf(n.type).duct),
    )
    return {
      project,
      thumbUrl: projectThumbDataUrl(project, 'screen'),
      warningCount,
      systems,
      updatedLabel: formatRelativeTime(project.updated),
    }
  })
})

const filteredCards = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return projectCards.value
  return projectCards.value.filter(card => card.project.name.toLowerCase().includes(q))
})

const parsedLengthM = computed(() => {
  const parsed = parseDecimalInput(newLengthM.value)
  return parsed && parsed > 0 ? Math.min(200, Math.max(0.6, parsed)) : 1
})

const parsedWidthM = computed(() => {
  const parsed = parseDecimalInput(newWidthM.value)
  return parsed && parsed > 0 ? Math.min(200, Math.max(0.6, parsed)) : 1
})

const roomPreviewRect = computed(() => {
  const p = parsedLengthM.value
  const l = parsedWidthM.value
  const k = Math.min(170 / p, 96 / l)
  const width = Math.round(p * k * 10) / 10
  const height = Math.round(l * k * 10) / 10
  return {
    x: Math.round(((220 - width) / 2) * 10) / 10,
    y: Math.round(((124 - height) / 2) * 10) / 10,
    width,
    height,
    label: `${formatPropNumber(p)} × ${formatPropNumber(l)} m`,
  }
})

const unitExampleLabel = computed(() => (newUnit.value === 'mm' ? '600x500' : '24"x20"'))

async function refreshProjects(allowSeed = false) {
  loading.value = true
  try {
    let list = await indexedDbProjectStorage.list()
    if (allowSeed && list.length === 0 && import.meta.client) {
      let alreadySeeded = false
      try {
        alreadySeeded = localStorage.getItem(SEEDED_STORAGE_KEY) === '1'
      }
      catch {
        alreadySeeded = false
      }
      if (!alreadySeeded) {
        const seededDemo: Project = { ...demoProject(), id: DEMO_PROJECT_ID }
        await indexedDbProjectStorage.save(seededDemo)
        try {
          localStorage.setItem(SEEDED_STORAGE_KEY, '1')
        }
        catch {
          // Abaikan bila localStorage dibatasi browser.
        }
        list = await indexedDbProjectStorage.list()
      }
    }
    projects.value = list
  }
  catch {
    toast.add({
      title: 'Gagal memuat daftar proyek',
      description: 'Penyimpanan lokal browser tidak dapat diakses saat ini.',
    })
  }
  finally {
    loading.value = false
  }
}

function openNewProjectModal() {
  newName.value = ''
  newUnit.value = 'inch'
  newScale.value = '1:100'
  newLengthM.value = '9'
  newWidthM.value = '6'
  newFormError.value = null
  newModalOpen.value = true
}

async function handleCreateProject() {
  const cleanedName = newName.value.trim()
  if (!cleanedName) {
    newFormError.value = 'Isi nama proyek terlebih dahulu.'
    return
  }
  const lengthVal = parseDecimalInput(newLengthM.value)
  const widthVal = parseDecimalInput(newWidthM.value)
  if (lengthVal === null || widthVal === null || lengthVal < 0.6 || widthVal < 0.6 || lengthVal > 200 || widthVal > 200) {
    newFormError.value = 'Ukuran ruangan awal harus antara 0,6 m sampai 200 m.'
    return
  }

  newFormError.value = null
  creatingProject.value = true
  try {
    const created = newProject({
      name: cleanedName,
      unit: newUnit.value,
      scale: newScale.value,
      W: Math.round(lengthVal * 1000),
      H: Math.round(widthVal * 1000),
    })
    await indexedDbProjectStorage.save(created)
    newModalOpen.value = false
    await router.push(`/editor/${created.id}`)
  }
  catch {
    newFormError.value = 'Gagal menyimpan proyek. Periksa ruang penyimpanan browser.'
  }
  finally {
    creatingProject.value = false
  }
}

async function handleOpenDemoProject() {
  try {
    const existing = await indexedDbProjectStorage.load(DEMO_PROJECT_ID)
    if (!existing) {
      const seededDemo: Project = { ...demoProject(), id: DEMO_PROJECT_ID }
      await indexedDbProjectStorage.save(seededDemo)
    }
    await router.push(`/editor/${DEMO_PROJECT_ID}`)
  }
  catch {
    await router.push(`/editor/${DEMO_PROJECT_ID}`)
  }
}

function handleDownloadProject(project: Project) {
  const filename = `${projectSlug(project.name)}.json`
  downloadTextFile(filename, JSON.stringify(project, null, 2), 'application/json')
  toast.add({ title: `Cadangan ${filename} diunduh` })
}

function requestDeleteProject(project: Project) {
  deleteTarget.value = project
}

async function confirmDeleteProject() {
  const target = deleteTarget.value
  if (!target) return
  const snapshot = JSON.parse(JSON.stringify(target)) as Project
  deleteTarget.value = null

  try {
    await indexedDbProjectStorage.remove(snapshot.id)
    projects.value = projects.value.filter(p => p.id !== snapshot.id)
    toast.add({
      title: `Proyek "${snapshot.name}" dihapus`,
      description: 'Masih dapat diurungkan sekarang sebelum meninggalkan halaman.',
      actions: [
        {
          label: 'Urungkan',
          color: 'primary',
          variant: 'solid',
          onClick: () => {
            void restoreDeletedProject(snapshot)
          },
        },
      ],
    })
  }
  catch {
    toast.add({ title: 'Gagal menghapus proyek' })
  }
}

async function restoreDeletedProject(snapshot: Project) {
  try {
    await indexedDbProjectStorage.save(snapshot)
    await refreshProjects(false)
    toast.add({ title: `Proyek "${snapshot.name}" dipulihkan` })
  }
  catch {
    toast.add({ title: 'Gagal memulihkan proyek' })
  }
}

async function handleImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    const text = await file.text()
    const result = parseImportedProjectJson(text)
    if (!result.ok) {
      toast.add({
        title: 'Gagal membuka file',
        description: result.error,
      })
      return
    }
    await indexedDbProjectStorage.save(result.project)
    if (result.migratedFrom === 1) {
      toast.add({
        title: 'File prototype v1 dimigrasi ke format v2',
        description: `Proyek "${result.project.name}" siap diedit.`,
      })
    }
    await router.push(`/editor/${result.project.id}`)
  }
  catch {
    toast.add({
      title: 'Gagal membuka file',
      description: 'Tidak dapat membaca file yang dipilih.',
    })
  }
}

onMounted(async () => {
  await refreshProjects(true)
  if (route.hash === '#new') {
    openNewProjectModal()
    void router.replace({ path: route.path, hash: '' })
  }
})

useHead({
  htmlAttrs: { lang: 'id' },
  title: 'Proyek · Temandor',
  meta: [
    {
      name: 'description',
      content: 'Daftar proyek sketsa ducting yang tersimpan lokal di browser ini.',
    },
  ],
})
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-wrap items-end gap-3">
      <div class="mr-auto min-w-0">
        <h1 class="font-cond font-bold text-4xl sm:text-5xl leading-none text-ink">
          Proyek
        </h1>
        <p class="mt-2 text-muted text-[15px]">
          Gambar denah, rangkai komponen duct, export ke DXF untuk AutoCAD.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <label class="btn-ghost max-sm:min-h-11 cursor-pointer">
          <UIcon
            name="i-lucide-upload"
            class="size-4"
            aria-hidden="true"
          />
          <span>Buka file .json</span>
          <input
            ref="fileInputRef"
            data-testid="import-json-input"
            type="file"
            accept=".json,application/json"
            class="sr-only"
            @change="handleImportFile"
          >
        </label>
        <button
          type="button"
          data-testid="new-project-btn"
          class="btn-primary max-sm:min-h-11"
          @click="openNewProjectModal"
        >
          <UIcon
            name="i-lucide-plus"
            class="size-4"
            aria-hidden="true"
          />
          <span>Proyek baru</span>
        </button>
      </div>
    </div>

    <div
      data-testid="local-storage-reminder"
      class="flex items-start gap-2.5 rounded-[10px] bg-panel ring-1 ring-line px-3.5 py-2.5 text-xs text-muted leading-relaxed"
    >
      <UIcon
        name="i-lucide-hard-drive"
        class="size-4 shrink-0 mt-0.5 text-ink"
        aria-hidden="true"
      />
      <span>
        Proyek tersimpan lokal di browser ini (tanpa akun). Unduh file <code class="font-mono text-ink">.json</code> sebagai cadangan sebelum menghapus data situs.
      </span>
    </div>

    <!-- Loading skeleton ringan -->
    <div
      v-if="loading"
      class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Memuat daftar proyek"
    >
      <div
        v-for="n in 3"
        :key="n"
        class="h-60 rounded-xl bg-panel ring-1 ring-line animate-pulse"
      />
    </div>

    <!-- Daftar proyek -->
    <template v-else-if="projects.length > 0">
      <div class="flex flex-wrap items-center gap-3">
        <div class="relative flex-1 min-w-[14rem] max-w-sm">
          <UIcon
            name="i-lucide-search"
            class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none"
            aria-hidden="true"
          />
          <input
            v-model="searchQuery"
            data-testid="project-search"
            type="search"
            placeholder="Cari nama proyek..."
            aria-label="Cari proyek"
            class="field pl-9!"
          >
        </div>
        <span
          data-testid="project-count"
          class="text-sm text-muted"
        >
          {{ projects.length }} proyek · disimpan di browser ini
        </span>
      </div>

      <p
        v-if="filteredCards.length === 0"
        data-testid="project-search-empty"
        class="py-10 text-center text-sm text-muted bg-panel rounded-xl ring-1 ring-line"
      >
        Tidak ada proyek dengan nama &quot;{{ searchQuery }}&quot;.
      </p>

      <div
        v-else
        data-testid="project-grid"
        class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <article
          v-for="item in filteredCards"
          :key="item.project.id"
          data-testid="project-card"
          :data-project-id="item.project.id"
          class="group flex flex-col bg-panel rounded-xl ring-1 ring-line hover:ring-ink overflow-hidden transition"
        >
          <NuxtLink
            :to="`/editor/${item.project.id}`"
            class="block flex-1 focus-visible:outline-2 focus-visible:outline-hazard focus-visible:-outline-offset-2"
          >
            <div class="h-40 bg-cad overflow-hidden p-2">
              <img
                :src="item.thumbUrl"
                alt=""
                class="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
              >
            </div>
            <div class="p-4 pb-2">
              <div class="flex items-start gap-2">
                <h2 class="font-semibold text-ink leading-snug mr-auto truncate">
                  {{ item.project.name }}
                </h2>
                <span
                  v-if="item.warningCount > 0"
                  class="shrink-0 text-xs font-semibold text-error-ink bg-error-wash ring-1 ring-red-200 rounded px-1.5 py-0.5"
                >
                  {{ item.warningCount }} warning
                </span>
                <span
                  v-else
                  class="shrink-0 text-xs font-semibold text-done-green bg-green-50 ring-1 ring-green-200 rounded px-1.5 py-0.5"
                >
                  Aman
                </span>
              </div>

              <div class="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                <span
                  v-for="sys in item.systems"
                  :key="sys"
                  class="px-1.5 py-0.5 rounded font-mono font-medium"
                  :class="sys === 'SA' ? 'bg-blue-100 text-blue-900' : 'bg-pink-100 text-pink-900'"
                >
                  {{ sys }}
                </span>
                <span class="font-mono text-muted">
                  {{ item.project.unit }} · {{ item.project.scale }}
                </span>
              </div>
            </div>
          </NuxtLink>

          <div class="px-4 pb-3 pt-1 flex items-center gap-2">
            <span class="text-xs text-muted mr-auto truncate">
              Diubah {{ item.updatedLabel }}
            </span>
            <button
              type="button"
              data-testid="project-download"
              class="btn-ghost h-8! px-2.5! text-xs! bg-panel"
              title="Unduh cadangan .json"
              @click="handleDownloadProject(item.project)"
            >
              Unduh
            </button>
            <button
              type="button"
              data-testid="project-delete"
              class="btn-ghost h-8! px-2.5! text-xs! bg-panel text-danger!"
              title="Hapus proyek"
              @click="requestDeleteProject(item.project)"
            >
              Hapus
            </button>
          </div>
        </article>

        <button
          type="button"
          data-testid="project-card-new"
          class="min-h-[15rem] rounded-xl border-2 border-dashed border-line hover:border-ink text-muted hover:text-ink grid place-items-center transition focus-visible:outline-2 focus-visible:outline-hazard focus-visible:outline-offset-2"
          @click="openNewProjectModal"
        >
          <span class="flex flex-col items-center gap-2">
            <UIcon
              name="i-lucide-plus"
              class="size-8"
              aria-hidden="true"
            />
            <span class="font-semibold text-sm">Proyek baru</span>
          </span>
        </button>
      </div>
    </template>

    <!-- Kondisi kosong (belum ada proyek) -->
    <section
      v-else
      data-testid="project-empty"
      class="rounded-2xl bg-panel ring-1 ring-line overflow-hidden"
    >
      <div class="grid md:grid-cols-[1.1fr_1fr]">
        <div class="p-7 sm:p-10">
          <h2 class="font-cond font-bold text-3xl sm:text-4xl leading-tight text-ink">
            Gambar jalur duct tanpa harus jago AutoCAD.
          </h2>
          <p class="mt-3 text-muted max-w-md text-[15px] leading-relaxed">
            Isi ukuran ruangan, lalu rangkai komponen seperti di lapangan: duct, elbow, T, diffuser.
          </p>
          <div class="mt-6 flex flex-wrap gap-2.5">
            <button
              type="button"
              data-testid="empty-new-btn"
              class="btn-primary h-10! px-5! text-[15px]!"
              @click="openNewProjectModal"
            >
              Buat proyek pertama
            </button>
            <button
              type="button"
              data-testid="open-demo-btn"
              class="btn-ghost h-10! px-5! text-[15px]!"
              @click="handleOpenDemoProject"
            >
              Buka proyek contoh
            </button>
          </div>
        </div>
        <ol class="bg-cad text-card/85 p-7 sm:p-10 space-y-6">
          <li class="flex gap-4">
            <span class="shrink-0 grid place-items-center size-8 rounded-full bg-hazard text-ink font-bold">1</span>
            <div>
              <strong class="text-card font-semibold">Isi ukuran ruangan</strong>
              <p class="text-sm text-card/75 mt-0.5">
                Panjang × lebar dalam meter.
              </p>
            </div>
          </li>
          <li class="flex gap-4">
            <span class="shrink-0 grid place-items-center size-8 rounded-full bg-hazard text-ink font-bold">2</span>
            <div>
              <strong class="text-card font-semibold">Rangkai duct dari komponen</strong>
              <p class="text-sm text-card/75 mt-0.5">
                Klik jalur duct atau seret komponen dari panel Elemen.
              </p>
            </div>
          </li>
          <li class="flex gap-4">
            <span class="shrink-0 grid place-items-center size-8 rounded-full bg-hazard text-ink font-bold">3</span>
            <div>
              <strong class="text-card font-semibold">Export ke DXF</strong>
              <p class="text-sm text-card/75 mt-0.5">
                Kirim ke drafter atau buka langsung di AutoCAD.
              </p>
            </div>
          </li>
        </ol>
      </div>
    </section>

    <!-- Modal Proyek Baru -->
    <UModal
      v-model:open="newModalOpen"
      title="Proyek baru"
      description="Ruangan awal bisa diubah atau ditambah lagi di editor."
    >
      <template #body>
        <form
          id="form-new-project"
          data-testid="new-project-form"
          class="space-y-5"
          @submit.prevent="handleCreateProject"
        >
          <div>
            <label
              class="field-label"
              for="new-project-name"
            >Nama proyek</label>
            <input
              id="new-project-name"
              v-model="newName"
              data-testid="new-project-name"
              type="text"
              required
              autocomplete="off"
              placeholder="mis. Kantor Lt. 2 - Ducting"
              class="field"
            >
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span class="field-label">Satuan duct</span>
              <div class="seg">
                <label>
                  <input
                    v-model="newUnit"
                    data-testid="new-unit-inch"
                    type="radio"
                    name="new-unit"
                    value="inch"
                  >
                  inch
                </label>
                <label>
                  <input
                    v-model="newUnit"
                    data-testid="new-unit-mm"
                    type="radio"
                    name="new-unit"
                    value="mm"
                  >
                  mm
                </label>
              </div>
              <p class="hint">
                Label: <span class="font-mono text-ink">{{ unitExampleLabel }}</span>
              </p>
            </div>

            <div>
              <label
                class="field-label"
                for="new-project-scale"
              >Skala gambar</label>
              <select
                id="new-project-scale"
                v-model="newScale"
                data-testid="new-project-scale"
                class="field"
              >
                <option value="1:50">
                  1:50
                </option>
                <option value="1:100">
                  1:100
                </option>
                <option value="1:200">
                  1:200
                </option>
              </select>
              <p class="hint">
                Mengatur besar teks di gambar.
              </p>
            </div>
          </div>

          <div>
            <span class="field-label">Ruangan awal</span>
            <div class="grid grid-cols-[1fr_1fr_auto] gap-3 items-start">
              <div class="field-unit">
                <input
                  v-model="newLengthM"
                  data-testid="new-room-length"
                  type="text"
                  inputmode="decimal"
                  aria-label="Panjang ruangan awal (meter)"
                >
                <span>m</span>
              </div>
              <div class="field-unit">
                <input
                  v-model="newWidthM"
                  data-testid="new-room-width"
                  type="text"
                  inputmode="decimal"
                  aria-label="Lebar ruangan awal (meter)"
                >
                <span>m</span>
              </div>
              <svg
                viewBox="0 0 220 124"
                class="row-span-2 w-24 sm:w-28 h-16 rounded bg-cad shrink-0"
                aria-hidden="true"
              >
                <rect
                  :x="roomPreviewRect.x"
                  :y="roomPreviewRect.y"
                  :width="roomPreviewRect.width"
                  :height="roomPreviewRect.height"
                  fill="#262b32"
                  stroke="#9aa3ad"
                  stroke-width="2"
                />
                <text
                  data-testid="new-room-preview"
                  x="110"
                  y="68"
                  fill="#e5e7eb"
                  font-size="18"
                  font-family="'JetBrains Mono', ui-monospace, monospace"
                  text-anchor="middle"
                >
                  {{ roomPreviewRect.label }}
                </text>
              </svg>
              <p class="hint col-span-2 -mt-1!">
                Panjang × lebar, ukuran luar dinding (menerima koma desimal).
              </p>
            </div>
          </div>

          <p
            v-if="newFormError"
            role="alert"
            class="rounded-lg bg-error-wash ring-1 ring-red-200 px-3 py-2 text-xs text-error-ink"
          >
            {{ newFormError }}
          </p>
        </form>
      </template>

      <template #footer>
        <button
          type="button"
          class="btn-ghost"
          @click="newModalOpen = false"
        >
          Batal
        </button>
        <button
          type="submit"
          form="form-new-project"
          data-testid="create-project-submit"
          class="btn-primary"
          :disabled="creatingProject"
        >
          Buat proyek →
        </button>
      </template>
    </UModal>

    <!-- Modal Konfirmasi Hapus -->
    <UModal
      v-model:open="deleteModalOpen"
      :title="deleteTarget ? `Hapus proyek '${deleteTarget.name}'?` : 'Hapus proyek?'"
      description="Proyek dihapus dari browser ini. Masih bisa diurungkan dari notifikasi setelahnya; setelah itu hanya bisa dipulihkan dari file .json."
    >
      <template #footer>
        <button
          type="button"
          class="btn-ghost"
          @click="deleteTarget = null"
        >
          Batal
        </button>
        <button
          type="button"
          data-testid="confirm-delete-project"
          class="btn-primary bg-danger! text-card! hover:bg-error-ink!"
          @click="confirmDeleteProject"
        >
          Hapus proyek
        </button>
      </template>
    </UModal>
  </section>
</template>
