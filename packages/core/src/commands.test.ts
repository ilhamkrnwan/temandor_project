import { describe, expect, it } from 'vitest'
import {
  COMMAND_REFERENCE,
  SHORTCUTS,
  matchShortcut,
  parseCommand,
} from './index'

describe('pintasan & baris perintah (commands.ts)', () => {
  it('parseCommand() memetakan perintah AutoCAD ke alat atau aksi dengan tepat', () => {
    expect(parseCommand('L')).toEqual({ kind: 'tool', tool: 'duct', label: 'Duct' })
    expect(parseCommand('line')).toEqual({ kind: 'tool', tool: 'duct', label: 'Duct' })
    expect(parseCommand('duct')).toEqual({ kind: 'tool', tool: 'duct', label: 'Duct' })
    expect(parseCommand('REC')).toEqual({ kind: 'tool', tool: 'room', label: 'Ruangan' })
    expect(parseCommand('ruang')).toEqual({ kind: 'tool', tool: 'room', label: 'Ruangan' })
    expect(parseCommand('PL')).toEqual({ kind: 'tool', tool: 'poly', label: 'Ruangan bebas' })
    expect(parseCommand('WALL')).toEqual({ kind: 'tool', tool: 'wall', label: 'Partisi' })
    expect(parseCommand('DIM')).toEqual({ kind: 'tool', tool: 'dim', label: 'Ukur' })
    expect(parseCommand('TEXT')).toEqual({ kind: 'tool', tool: 'text', label: 'Teks' })
    expect(parseCommand('PEN')).toEqual({ kind: 'tool', tool: 'pen', label: 'Coretan tangan' })
    expect(parseCommand('SELECT')).toEqual({ kind: 'tool', tool: 'select', label: 'Pilih' })
    expect(parseCommand('PAN')).toEqual({ kind: 'tool', tool: 'pan', label: 'Geser kanvas' })

    expect(parseCommand('BOQ')).toEqual({ kind: 'action', action: 'dialog:boq', label: 'Daftar material (BOQ)' })
    expect(parseCommand('material')).toEqual({ kind: 'action', action: 'dialog:boq', label: 'Daftar material (BOQ)' })
    expect(parseCommand('Z')).toEqual({ kind: 'action', action: 'view:zoom-fit', label: 'Lihat semua' })
    expect(parseCommand('ZS')).toEqual({ kind: 'action', action: 'view:zoom-selection', label: 'Zoom pilihan' })
    expect(parseCommand('U')).toEqual({ kind: 'action', action: 'edit:undo', label: 'Undo' })
    expect(parseCommand('REDO')).toEqual({ kind: 'action', action: 'edit:redo', label: 'Redo' })
    expect(parseCommand('?')).toEqual({ kind: 'action', action: 'help:shortcuts', label: 'Pintasan' })

    // Angka panjang & dimensi P x L (meter < 100 otomatis jadi mm)
    expect(parseCommand('1500')).toEqual({ kind: 'length', mm: 1500 })
    expect(parseCommand('6x4')).toEqual({ kind: 'dimensions', widthMm: 6000, heightMm: 4000 })
    expect(parseCommand('6.5x4.5')).toEqual({ kind: 'dimensions', widthMm: 6500, heightMm: 4500 })
    expect(parseCommand('6,5x4,5')).toEqual({ kind: 'dimensions', widthMm: 6500, heightMm: 4500 })
    expect(parseCommand('6000,4000')).toEqual({ kind: 'dimensions', widthMm: 6000, heightMm: 4000 })
    expect(parseCommand('6000 4500')).toEqual({ kind: 'dimensions', widthMm: 6000, heightMm: 4500 })

    // Kosong dan perintah tidak dikenal
    expect(parseCommand('   ')).toEqual({ kind: 'empty' })
    expect(parseCommand('TIDAKADA')).toEqual({ kind: 'unknown', raw: 'TIDAKADA' })

    // Semua referensi perintah di dialog '?' valid di parseCommand()
    for (const ref of COMMAND_REFERENCE) {
      expect(parseCommand(ref.cmd).kind).not.toBe('unknown')
    }
  })

  it('matchShortcut() membedakan modifier (Ctrl/Shift) dan semua entri SHORTCUTS unik & cocok', () => {
    // Setiap entri SHORTCUTS punya ID unik dan minimal satu matcher
    const ids = new Set(SHORTCUTS.map(s => s.id))
    expect(ids.size).toBe(SHORTCUTS.length)

    // Disambiguasi Z vs Shift+Z vs Ctrl+Z vs Ctrl+Shift+Z
    expect(matchShortcut({ key: 'z' })?.id).toBe('view:zoom-selection')
    expect(matchShortcut({ key: 'Z', shiftKey: true })?.id).toBe('view:zoom-fit')
    expect(matchShortcut({ key: 'z', ctrlKey: true })?.id).toBe('edit:undo')
    expect(matchShortcut({ key: 'Z', ctrlKey: true, shiftKey: true })?.id).toBe('edit:redo')
    expect(matchShortcut({ key: 'y', ctrlKey: true })?.id).toBe('edit:redo')

    // Ctrl+G vs Ctrl+Shift+G vs G (diffuser)
    expect(matchShortcut({ key: 'g' })?.id).toBe('tool:diffuser')
    expect(matchShortcut({ key: 'g', ctrlKey: true })?.id).toBe('edit:group')
    expect(matchShortcut({ key: 'G', ctrlKey: true, shiftKey: true })?.id).toBe('edit:ungroup')

    // Panel & fokus: Ctrl+[, Ctrl+], Ctrl+. vs [ / ] urutan
    expect(matchShortcut({ key: '[' })?.id).toBe('edit:order-back')
    expect(matchShortcut({ key: ']' })?.id).toBe('edit:order-front')
    expect(matchShortcut({ key: '[', ctrlKey: true })?.id).toBe('view:toggle-lib')
    expect(matchShortcut({ key: ']', ctrlKey: true })?.id).toBe('view:toggle-side')
    expect(matchShortcut({ key: '.', ctrlKey: true })?.id).toBe('view:focus-mode')

    // Dialog '?' bekerja meski Shift ditekan pada keyboard US
    expect(matchShortcut({ key: '?', shiftKey: true })?.id).toBe('help:shortcuts')

    // Saat fokus di input, hanya Ctrl+S yang lolos
    expect(matchShortcut({ key: 's', ctrlKey: true }, true)?.id).toBe('edit:save')
    expect(matchShortcut({ key: 'z', ctrlKey: true }, true)).toBeNull()
    expect(matchShortcut({ key: 'r' }, true)).toBeNull()
    expect(matchShortcut({ key: 'f7', altKey: true })).toBeNull()
  })
})
