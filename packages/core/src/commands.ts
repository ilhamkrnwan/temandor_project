export type EditorTool
  = | 'select'
    | 'pan'
    | 'duct'
    | 'room'
    | 'poly'
    | 'wall'
    | 'dim'
    | 'text'
    | 'pen'
    | 'place'

export type ShortcutSection = 'Alat' | 'Edit' | 'Tampilan'

export const SHORTCUT_SECTIONS: readonly ShortcutSection[] = ['Alat', 'Edit', 'Tampilan'] as const

export type ShortcutAction
  = | 'tool:select'
    | 'tool:pan'
    | 'tool:room'
    | 'tool:poly'
    | 'tool:wall'
    | 'tool:duct'
    | 'tool:fitting'
    | 'tool:equip'
    | 'tool:diffuser'
    | 'tool:dim'
    | 'tool:text'
    | 'tool:pen'
    | 'edit:rotate'
    | 'edit:mirror'
    | 'edit:delete'
    | 'edit:copy'
    | 'edit:paste'
    | 'edit:duplicate'
    | 'edit:group'
    | 'edit:ungroup'
    | 'edit:nudge-left'
    | 'edit:nudge-right'
    | 'edit:nudge-up'
    | 'edit:nudge-down'
    | 'edit:select-all'
    | 'edit:undo'
    | 'edit:redo'
    | 'edit:save'
    | 'edit:order-front'
    | 'edit:order-back'
    | 'edit:escape'
    | 'view:zoom-selection'
    | 'view:zoom-fit'
    | 'view:zoom-in'
    | 'view:zoom-out'
    | 'view:toggle-snap'
    | 'view:toggle-grid'
    | 'view:toggle-ortho'
    | 'view:focus-mode'
    | 'view:toggle-lib'
    | 'view:toggle-side'
    | 'help:ai'
    | 'help:shortcuts'

export interface ShortcutKeyMatch {
  readonly key: string
  readonly ctrl?: boolean
  readonly shift?: boolean
  readonly allowInInput?: boolean
}

export interface ShortcutDef {
  readonly id: ShortcutAction
  readonly section: ShortcutSection
  readonly keys: readonly string[]
  readonly label: string
  readonly matches: readonly ShortcutKeyMatch[]
}

/**
 * Sumber tunggal pintasan keyboard editor:
 * dipakai langsung oleh handler keyboard (`matchShortcut`) dan dialog bantuan (`?`).
 */
export const SHORTCUTS: readonly ShortcutDef[] = [
  // ---- Alat ----
  { id: 'tool:select', section: 'Alat', keys: ['V'], label: 'Pilih', matches: [{ key: 'v', ctrl: false }] },
  { id: 'tool:pan', section: 'Alat', keys: ['H'], label: 'Geser kanvas', matches: [{ key: 'h', ctrl: false }] },
  { id: 'tool:room', section: 'Alat', keys: ['K'], label: 'Ruangan kotak', matches: [{ key: 'k', ctrl: false }] },
  { id: 'tool:poly', section: 'Alat', keys: ['P'], label: 'Ruangan bebas (L, T, poligon)', matches: [{ key: 'p', ctrl: false }] },
  { id: 'tool:wall', section: 'Alat', keys: ['W'], label: 'Partisi', matches: [{ key: 'w', ctrl: false }] },
  { id: 'tool:duct', section: 'Alat', keys: ['D'], label: 'Duct', matches: [{ key: 'd', ctrl: false }] },
  { id: 'tool:fitting', section: 'Alat', keys: ['F'], label: 'Fitting (buka Elemen)', matches: [{ key: 'f', ctrl: false }] },
  { id: 'tool:equip', section: 'Alat', keys: ['E'], label: 'Equipment (buka Elemen)', matches: [{ key: 'e', ctrl: false }] },
  { id: 'tool:diffuser', section: 'Alat', keys: ['G'], label: 'Diffuser (buka Elemen)', matches: [{ key: 'g', ctrl: false }] },
  { id: 'tool:dim', section: 'Alat', keys: ['U'], label: 'Ukur / dimensi', matches: [{ key: 'u', ctrl: false }] },
  { id: 'tool:text', section: 'Alat', keys: ['T'], label: 'Teks', matches: [{ key: 't', ctrl: false }] },
  { id: 'tool:pen', section: 'Alat', keys: ['B'], label: 'Coretan tangan', matches: [{ key: 'b', ctrl: false }] },

  // ---- Edit ----
  { id: 'edit:rotate', section: 'Edit', keys: ['R'], label: 'Putar 90° / balik arah buka pintu', matches: [{ key: 'r', ctrl: false }] },
  { id: 'edit:mirror', section: 'Edit', keys: ['M'], label: 'Cermin / balik engsel pintu', matches: [{ key: 'm', ctrl: false }] },
  { id: 'edit:delete', section: 'Edit', keys: ['Del'], label: 'Hapus komponen terpilih', matches: [{ key: 'delete', ctrl: false }, { key: 'backspace', ctrl: false }] },
  { id: 'edit:copy', section: 'Edit', keys: ['Ctrl', 'C'], label: 'Salin', matches: [{ key: 'c', ctrl: true, shift: false }] },
  { id: 'edit:paste', section: 'Edit', keys: ['Ctrl', 'V'], label: 'Tempel', matches: [{ key: 'v', ctrl: true, shift: false }] },
  { id: 'edit:duplicate', section: 'Edit', keys: ['Ctrl', 'D'], label: 'Duplikat', matches: [{ key: 'd', ctrl: true, shift: false }] },
  { id: 'edit:group', section: 'Edit', keys: ['Ctrl', 'G'], label: 'Group', matches: [{ key: 'g', ctrl: true, shift: false }] },
  { id: 'edit:ungroup', section: 'Edit', keys: ['Ctrl', 'Shift', 'G'], label: 'Ungroup', matches: [{ key: 'g', ctrl: true, shift: true }] },
  { id: 'edit:nudge-left', section: 'Edit', keys: ['←'], label: 'Geser kiri 10 mm (+Shift 100 mm)', matches: [{ key: 'arrowleft', ctrl: false }] },
  { id: 'edit:nudge-right', section: 'Edit', keys: ['→'], label: 'Geser kanan 10 mm (+Shift 100 mm)', matches: [{ key: 'arrowright', ctrl: false }] },
  { id: 'edit:nudge-up', section: 'Edit', keys: ['↑'], label: 'Geser atas 10 mm (+Shift 100 mm)', matches: [{ key: 'arrowup', ctrl: false }] },
  { id: 'edit:nudge-down', section: 'Edit', keys: ['↓'], label: 'Geser bawah 10 mm (+Shift 100 mm)', matches: [{ key: 'arrowdown', ctrl: false }] },
  { id: 'edit:select-all', section: 'Edit', keys: ['Ctrl', 'A'], label: 'Pilih semua', matches: [{ key: 'a', ctrl: true, shift: false }] },
  { id: 'edit:undo', section: 'Edit', keys: ['Ctrl', 'Z'], label: 'Urungkan (Undo)', matches: [{ key: 'z', ctrl: true, shift: false }] },
  { id: 'edit:redo', section: 'Edit', keys: ['Ctrl', 'Y'], label: 'Ulangi (Redo)', matches: [{ key: 'y', ctrl: true, shift: false }, { key: 'z', ctrl: true, shift: true }] },
  { id: 'edit:save', section: 'Edit', keys: ['Ctrl', 'S'], label: 'Simpan sekarang', matches: [{ key: 's', ctrl: true, allowInInput: true }] },
  { id: 'edit:order-front', section: 'Edit', keys: [']'], label: 'Pindah ke depan', matches: [{ key: ']', ctrl: false }] },
  { id: 'edit:order-back', section: 'Edit', keys: ['['], label: 'Pindah ke belakang', matches: [{ key: '[', ctrl: false }] },
  { id: 'edit:escape', section: 'Edit', keys: ['Esc'], label: 'Batal / kembali ke Pilih', matches: [{ key: 'escape', ctrl: false }] },

  // ---- Tampilan ----
  { id: 'view:zoom-selection', section: 'Tampilan', keys: ['Z'], label: 'Zoom ke pilihan', matches: [{ key: 'z', ctrl: false, shift: false }] },
  { id: 'view:zoom-fit', section: 'Tampilan', keys: ['Shift', 'Z'], label: 'Lihat semua', matches: [{ key: 'z', ctrl: false, shift: true }] },
  { id: 'view:zoom-in', section: 'Tampilan', keys: ['+'], label: 'Perbesar', matches: [{ key: '+', ctrl: false }, { key: '=', ctrl: false }] },
  { id: 'view:zoom-out', section: 'Tampilan', keys: ['-'], label: 'Perkecil', matches: [{ key: '-', ctrl: false }] },
  { id: 'view:toggle-snap', section: 'Tampilan', keys: ['F3'], label: 'Aktif/nonaktif Snap', matches: [{ key: 'f3', ctrl: false }] },
  { id: 'view:toggle-grid', section: 'Tampilan', keys: ['F7'], label: 'Tampil/sembunyi Grid', matches: [{ key: 'f7', ctrl: false }] },
  { id: 'view:toggle-ortho', section: 'Tampilan', keys: ['F8'], label: 'Aktif/nonaktif Ortho', matches: [{ key: 'f8', ctrl: false }] },
  { id: 'view:focus-mode', section: 'Tampilan', keys: ['Ctrl', '.'], label: 'Mode fokus (tutup semua panel)', matches: [{ key: '.', ctrl: true }] },
  { id: 'view:toggle-lib', section: 'Tampilan', keys: ['Ctrl', '['], label: 'Buka/tutup panel kiri', matches: [{ key: '[', ctrl: true }] },
  { id: 'view:toggle-side', section: 'Tampilan', keys: ['Ctrl', ']'], label: 'Buka/tutup panel properti', matches: [{ key: ']', ctrl: true }] },
  { id: 'help:ai', section: 'Tampilan', keys: ['Ctrl', 'K'], label: 'Buka/tutup Asisten AI', matches: [{ key: 'k', ctrl: true, allowInInput: true }] },
  { id: 'help:shortcuts', section: 'Tampilan', keys: ['?'], label: 'Buka daftar pintasan ini', matches: [{ key: '?', ctrl: false }] },
] as const

export interface KeyEventLike {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
}

/** Cocokkan event keyboard terhadap tabel tunggal `SHORTCUTS`. */
export function matchShortcut(event: KeyEventLike, inInput = false): ShortcutDef | null {
  if (event.altKey) return null
  const ctrl = Boolean(event.ctrlKey || event.metaKey)
  const shift = Boolean(event.shiftKey)
  const key = event.key.toLowerCase()

  for (const def of SHORTCUTS) {
    for (const m of def.matches) {
      if (inInput && !m.allowInInput) continue
      if (m.key !== key) continue
      if (Boolean(m.ctrl) !== ctrl) continue
      if (m.shift !== undefined && m.shift !== shift) continue
      return def
    }
  }
  return null
}

// ---- Baris perintah gaya AutoCAD ----

export type CommandActionId = 'view:zoom-fit' | 'view:zoom-selection' | 'edit:undo' | 'edit:redo' | 'dialog:boq' | 'help:shortcuts'

export type ParsedCommand
  = | { kind: 'empty' }
    | { kind: 'tool', tool: EditorTool, label: string }
    | { kind: 'action', action: CommandActionId, label: string }
    | { kind: 'length', mm: number }
    | { kind: 'dimensions', widthMm: number, heightMm: number }
    | { kind: 'unknown', raw: string }

interface ToolCommandDef {
  kind: 'tool'
  tool: EditorTool
  label: string
}

interface ActionCommandDef {
  kind: 'action'
  action: CommandActionId
  label: string
}

type AliasTarget = ToolCommandDef | ActionCommandDef

export const COMMAND_ALIASES: Readonly<Record<string, AliasTarget>> = {
  'L': { kind: 'tool', tool: 'duct', label: 'Duct' },
  'LINE': { kind: 'tool', tool: 'duct', label: 'Duct' },
  'DUCT': { kind: 'tool', tool: 'duct', label: 'Duct' },
  'REC': { kind: 'tool', tool: 'room', label: 'Ruangan' },
  'RUANG': { kind: 'tool', tool: 'room', label: 'Ruangan' },
  'PL': { kind: 'tool', tool: 'poly', label: 'Ruangan bebas' },
  'POLY': { kind: 'tool', tool: 'poly', label: 'Ruangan bebas' },
  'WALL': { kind: 'tool', tool: 'wall', label: 'Partisi' },
  'PARTISI': { kind: 'tool', tool: 'wall', label: 'Partisi' },
  'DIM': { kind: 'tool', tool: 'dim', label: 'Ukur' },
  'UKUR': { kind: 'tool', tool: 'dim', label: 'Ukur' },
  'TEXT': { kind: 'tool', tool: 'text', label: 'Teks' },
  'TEKS': { kind: 'tool', tool: 'text', label: 'Teks' },
  'PEN': { kind: 'tool', tool: 'pen', label: 'Coretan tangan' },
  'CORET': { kind: 'tool', tool: 'pen', label: 'Coretan tangan' },
  'SELECT': { kind: 'tool', tool: 'select', label: 'Pilih' },
  'PILIH': { kind: 'tool', tool: 'select', label: 'Pilih' },
  'PAN': { kind: 'tool', tool: 'pan', label: 'Geser kanvas' },
  'GESER': { kind: 'tool', tool: 'pan', label: 'Geser kanvas' },
  'Z': { kind: 'action', action: 'view:zoom-fit', label: 'Lihat semua' },
  'ZOOM': { kind: 'action', action: 'view:zoom-fit', label: 'Lihat semua' },
  'ZS': { kind: 'action', action: 'view:zoom-selection', label: 'Zoom pilihan' },
  'U': { kind: 'action', action: 'edit:undo', label: 'Undo' },
  'UNDO': { kind: 'action', action: 'edit:undo', label: 'Undo' },
  'REDO': { kind: 'action', action: 'edit:redo', label: 'Redo' },
  'BOQ': { kind: 'action', action: 'dialog:boq', label: 'Daftar material (BOQ)' },
  'MATERIAL': { kind: 'action', action: 'dialog:boq', label: 'Daftar material (BOQ)' },
  '?': { kind: 'action', action: 'help:shortcuts', label: 'Pintasan' },
  'HELP': { kind: 'action', action: 'help:shortcuts', label: 'Pintasan' },
  'BANTUAN': { kind: 'action', action: 'help:shortcuts', label: 'Pintasan' },
}

export const COMMAND_REFERENCE: ReadonlyArray<{ cmd: string, label: string }> = [
  { cmd: 'L', label: 'Duct' },
  { cmd: 'REC', label: 'Ruangan' },
  { cmd: 'PL', label: 'Ruangan bebas' },
  { cmd: 'WALL', label: 'Partisi' },
  { cmd: 'DIM', label: 'Ukur' },
  { cmd: 'TEXT', label: 'Teks' },
  { cmd: 'BOQ', label: 'Daftar material' },
  { cmd: 'Z', label: 'Lihat semua' },
  { cmd: 'ZS', label: 'Zoom pilihan' },
  { cmd: 'U', label: 'Undo' },
]

export const TOOL_HINTS: Readonly<Record<EditorTool, string>> = {
  select: '',
  pan: 'Geser kanvas (seret layar atau tekan V untuk kembali ke Pilih)',
  duct: 'Duct: klik titik awal, belok otomatis pasang elbow, ketik angka + Enter untuk panjang (mm)',
  room: 'Ruangan: sudut 1 atau ketik P x L (mis. 6x4 + Enter)',
  poly: 'Ruangan bebas: klik titik sudut, Enter untuk tutup',
  wall: 'Partisi: titik awal ke titik akhir, Esc selesai',
  dim: 'Ukur: titik 1, titik 2, lalu posisi garis',
  text: 'Teks: klik posisi catatan di kanvas',
  pen: 'Coretan tangan: tahan & seret, Esc selesai',
  place: 'Taruh komponen di kanvas, R putar, Esc batal',
}

/** Parse input baris perintah AutoCAD: nama perintah, panjang tunggal (mm), atau dimensi P x L. */
export function parseCommand(raw: string): ParsedCommand {
  const trimmed = raw.trim()
  if (!trimmed) return { kind: 'empty' }

  // Cek input angka: panjang tunggal (1200) atau dimensi P x L (6x4, 6.5x4.5, 6,5x4,5, 6000,4000, 6000 4000)
  if (/^[\d.,]+(?:[\sx*,]+[\d.,]+)?$/i.test(trimmed)) {
    const hasExplicitDimSep = /[\sx*]/i.test(trimmed)
    const rawParts = hasExplicitDimSep
      ? trimmed.split(/[\sx*]+/i).filter(Boolean).map(p => Number(p.replace(',', '.')))
      : trimmed.includes(',')
        ? trimmed.split(/,+/).filter(Boolean).map(p => Number(p))
        : [Number(trimmed)]

    if (rawParts.length === 1 && Number.isFinite(rawParts[0]) && rawParts[0]! > 0) {
      return { kind: 'length', mm: Math.round(rawParts[0]!) }
    }
    if (rawParts.length === 2 && rawParts.every(n => Number.isFinite(n) && n > 0)) {
      let [w, h] = rawParts as [number, number]
      if (w < 100 && h < 100) {
        w *= 1000
        h *= 1000
      }
      return { kind: 'dimensions', widthMm: Math.round(w), heightMm: Math.round(h) }
    }
  }

  const key = trimmed.toUpperCase()
  const hit = COMMAND_ALIASES[key]
  if (hit) {
    return hit.kind === 'tool'
      ? { kind: 'tool', tool: hit.tool, label: hit.label }
      : { kind: 'action', action: hit.action, label: hit.label }
  }

  return { kind: 'unknown', raw: trimmed }
}
