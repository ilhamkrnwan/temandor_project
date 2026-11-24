import type { PaletteName } from '../../shared/cad'

export type CanvasTheme = 'dark' | 'light'

const STORAGE_KEY = 'temandor.theme'

function readStoredTheme(): CanvasTheme {
  if (!import.meta.client) return 'dark'
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
  }
  catch {
    return 'dark'
  }
}

export function useCanvasTheme() {
  const theme = useState<CanvasTheme>('temandor-canvas-theme', () => readStoredTheme())

  if (import.meta.client) {
    const stored = readStoredTheme()
    if (theme.value !== stored) {
      theme.value = stored
    }
  }

  const isLight = computed(() => theme.value === 'light')
  const palette = computed<PaletteName>(() => (theme.value === 'light' ? 'light' : 'screen'))

  function setTheme(next: CanvasTheme) {
    theme.value = next
    if (import.meta.client) {
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      }
      catch {
        // Mode privat / kuota penuh: tetap ubah state memori.
      }
    }
  }

  function toggle() {
    setTheme(theme.value === 'light' ? 'dark' : 'light')
  }

  return {
    theme,
    isLight,
    palette,
    setTheme,
    toggle,
  }
}
