export type RailCategory = 'elemen' | 'alat' | 'teks' | 'layer' | 'proyek'

export const RAIL_CATEGORIES: ReadonlyArray<{ id: RailCategory, label: string, title: string }> = [
  { id: 'elemen', label: 'Elemen', title: 'Komponen: ruangan, arsitektur, duct, equipment' },
  { id: 'alat', label: 'Alat', title: 'Alat gambar: duct, ruangan bebas, partisi, ukur, coretan' },
  { id: 'teks', label: 'Teks', title: 'Teks & catatan' },
  { id: 'layer', label: 'Layer', title: 'Layer: tampil/sembunyi, kunci' },
  { id: 'proyek', label: 'Proyek', title: 'Daftar proyek & pengaturan proyek ini' },
]

const STORAGE_KEY = 'temandor.panels'
const VALID_CATS = new Set<string>(RAIL_CATEGORIES.map(c => c.id))

interface PersistedPanels {
  lib: boolean
  side: boolean
  cat: RailCategory
}

function readPersistedPanels(): PersistedPanels {
  const fallback: PersistedPanels = { lib: true, side: true, cat: 'elemen' }
  if (!import.meta.client) return fallback
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<PersistedPanels>
    return {
      lib: typeof parsed.lib === 'boolean' ? parsed.lib : true,
      side: typeof parsed.side === 'boolean' ? parsed.side : true,
      cat: typeof parsed.cat === 'string' && VALID_CATS.has(parsed.cat) ? parsed.cat as RailCategory : 'elemen',
    }
  }
  catch {
    return fallback
  }
}

export function useWorkspacePanels() {
  const isDesktop = ref(true)
  const libOpenDesktop = ref(true)
  const sideOpenDesktop = ref(true)
  const activeCat = ref<RailCategory>('elemen')

  const mobileLibOpen = ref(false)
  const mobileSideOpen = ref(false)

  function persist() {
    if (!import.meta.client) return
    try {
      const payload: PersistedPanels = {
        lib: libOpenDesktop.value,
        side: sideOpenDesktop.value,
        cat: activeCat.value,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    }
    catch {
      // Abaikan jika penyimpanan dibatasi browser.
    }
  }

  const isLibVisible = computed(() => (isDesktop.value ? libOpenDesktop.value : mobileLibOpen.value))
  const isFocusMode = computed(() => !libOpenDesktop.value && !sideOpenDesktop.value)
  const showMobileScrim = computed(() => !isDesktop.value && (mobileLibOpen.value || mobileSideOpen.value))

  function isSideVisible(hasSelection: boolean): boolean {
    if (isDesktop.value) return sideOpenDesktop.value && hasSelection
    return mobileSideOpen.value
  }

  function showReopenSideTab(hasSelection: boolean): boolean {
    return isDesktop.value && !sideOpenDesktop.value && hasSelection
  }

  function openCategory(cat: RailCategory) {
    if (isDesktop.value) {
      const closing = libOpenDesktop.value && activeCat.value === cat
      activeCat.value = cat
      libOpenDesktop.value = !closing
      persist()
      return
    }
    const closing = mobileLibOpen.value && activeCat.value === cat
    activeCat.value = cat
    mobileSideOpen.value = false
    mobileLibOpen.value = !closing
    persist()
  }

  function toggleLib() {
    if (isDesktop.value) {
      libOpenDesktop.value = !libOpenDesktop.value
      persist()
      return
    }
    mobileSideOpen.value = false
    mobileLibOpen.value = !mobileLibOpen.value
  }

  function toggleSide() {
    if (isDesktop.value) {
      sideOpenDesktop.value = !sideOpenDesktop.value
      persist()
      return
    }
    mobileLibOpen.value = false
    mobileSideOpen.value = !mobileSideOpen.value
  }

  function openSide() {
    if (isDesktop.value) {
      if (!sideOpenDesktop.value) {
        sideOpenDesktop.value = true
        persist()
      }
      return
    }
    mobileLibOpen.value = false
    mobileSideOpen.value = true
  }

  function toggleFocusMode() {
    if (isDesktop.value) {
      const anyOpen = libOpenDesktop.value || sideOpenDesktop.value
      libOpenDesktop.value = !anyOpen
      sideOpenDesktop.value = !anyOpen
      persist()
      return
    }
    mobileLibOpen.value = false
    mobileSideOpen.value = false
  }

  function closeMobileSheets() {
    mobileLibOpen.value = false
    mobileSideOpen.value = false
  }

  if (import.meta.client) {
    let mediaQuery: MediaQueryList | null = null
    const onMediaChange = () => {
      if (!mediaQuery) return
      isDesktop.value = mediaQuery.matches
      mobileLibOpen.value = false
      mobileSideOpen.value = false
    }

    onMounted(() => {
      const saved = readPersistedPanels()
      libOpenDesktop.value = saved.lib
      sideOpenDesktop.value = saved.side
      activeCat.value = saved.cat

      mediaQuery = window.matchMedia('(min-width: 1024px)')
      isDesktop.value = mediaQuery.matches
      mediaQuery.addEventListener('change', onMediaChange)
    })

    onBeforeUnmount(() => {
      mediaQuery?.removeEventListener('change', onMediaChange)
    })
  }

  return {
    isDesktop,
    libOpenDesktop,
    sideOpenDesktop,
    activeCat,
    mobileLibOpen,
    mobileSideOpen,
    isLibVisible,
    isFocusMode,
    showMobileScrim,
    isSideVisible,
    showReopenSideTab,
    openCategory,
    toggleLib,
    toggleSide,
    openSide,
    toggleFocusMode,
    closeMobileSheets,
  }
}
