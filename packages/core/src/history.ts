import type { Project } from './types'

export const DEFAULT_MAX_HISTORY = 200

export interface HistoryEntry {
  label: string
  snapshot: string
}

export interface HistoryState {
  past: HistoryEntry[]
  future: HistoryEntry[]
  maxSteps: number
}

export interface CommitResult {
  project: Project
  changed: boolean
}

export interface HistoryMoveResult {
  project: Project
  label: string
}

export function createHistory(maxSteps = DEFAULT_MAX_HISTORY): HistoryState {
  return {
    past: [],
    future: [],
    maxSteps: Math.max(1, Math.floor(maxSteps)),
  }
}

export function clearHistory(history: HistoryState): void {
  history.past.length = 0
  history.future.length = 0
}

export function serializeProject(project: Project): string {
  return JSON.stringify(project)
}

export function deserializeProject(raw: string): Project {
  return JSON.parse(raw) as Project
}

export function cloneProject(project: Project): Project {
  return deserializeProject(serializeProject(project))
}

/**
 * Jalankan mutasi pada salinan proyek dan simpan snapshot sebelum berubah ke tumpukan riwayat.
 * Satu panggilan `commitProject` = satu langkah undo; perubahan tanpa selisih diabaikan.
 */
export function commitProject(
  history: HistoryState,
  current: Project,
  label: string,
  mutate: (draft: Project) => void,
): CommitResult {
  const before = serializeProject(current)
  const draft = deserializeProject(before)
  mutate(draft)
  const after = serializeProject(draft)

  if (after === before) {
    return { project: current, changed: false }
  }

  history.past.push({ label, snapshot: before })
  while (history.past.length > history.maxSteps) {
    history.past.shift()
  }
  history.future.length = 0

  return { project: draft, changed: true }
}

/** Kembalikan satu langkah terakhir dari `past` dan pindahkan state sekarang ke `future`. */
export function undoProject(history: HistoryState, current: Project): HistoryMoveResult | null {
  const entry = history.past.pop()
  if (!entry) return null
  history.future.push({ label: entry.label, snapshot: serializeProject(current) })
  return {
    project: deserializeProject(entry.snapshot),
    label: entry.label,
  }
}

/** Ulangi satu langkah terakhir dari `future` dan pindahkan state sekarang kembali ke `past`. */
export function redoProject(history: HistoryState, current: Project): HistoryMoveResult | null {
  const entry = history.future.pop()
  if (!entry) return null
  history.past.push({ label: entry.label, snapshot: serializeProject(current) })
  while (history.past.length > history.maxSteps) {
    history.past.shift()
  }
  return {
    project: deserializeProject(entry.snapshot),
    label: entry.label,
  }
}
