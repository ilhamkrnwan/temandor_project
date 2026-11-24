import { componentOf, connect, ctxOf, worldPrims } from './components'
import { sizeLabel } from './geom'
import type { Project } from './types'

export type BoqCategory = 'Duct' | 'Fitting' | 'Perlengkapan' | 'Equipment'

export type BoqUnit = 'm' | 'bh' | 'unit' | 'titik'

export interface BoqRow {
  kat: BoqCategory
  item: string
  spec: string
  qty: number
  unit: BoqUnit
}

export interface BoqSummary {
  count: number
  totalDuctMeters: number
  label: string
}

export const BOQ_ORDER: readonly BoqCategory[] = [
  'Duct',
  'Fitting',
  'Perlengkapan',
  'Equipment',
] as const

export const BOQ_DISCLAIMER = 'Belum termasuk sisa potong, sambungan, dan sealant.'

/**
 * Hitung daftar material (BOQ) langsung dari node gambar proyek.
 * Mengelompokkan panjang duct per sistem & ukuran, fitting, diffuser/grille/perlengkapan,
 * gantungan duct, dan equipment.
 */
export function boq(project: Project): BoqRow[] {
  const unit = project.unit
  const ctx = ctxOf(project, connect(project))
  const rows = new Map<string, BoqRow>()

  const sz = (w: number, h: number, shape: 'rect' | 'round') => sizeLabel(w, h, shape, unit)
  const add = (kat: BoqCategory, item: string, spec: string, qty: number, rowUnit: BoqUnit) => {
    const key = [kat, item, spec, rowUnit].join('|')
    const existing = rows.get(key)
    if (existing) {
      existing.qty += qty
    }
    else {
      rows.set(key, { kat, item, spec, qty, unit: rowUnit })
    }
  }

  let hang = 0
  for (const n of project.nodes) {
    const comp = componentOf(n.type)
    const sys = 'sys' in n && n.sys ? ` ${n.sys}` : ''

    switch (n.type) {
      case 'straight':
      case 'flex':
        add('Duct', comp.name + sys, sz(n.w, n.h, n.shape), n.L / 1000, 'm')
        break
      case 'elbow': {
        const reducing = n.w2 != null && (n.w2 !== n.w || n.h2 !== n.h)
        const endSize = reducing ? ` → ${sz(n.w2!, n.h2 ?? n.h, n.shape)}` : ''
        add(
          'Fitting',
          `Elbow ${n.et === 'sq' ? 'siku + vane' : 'radius'}${sys}`,
          `${sz(n.w, n.h, n.shape)}${endSize} · ${n.angle}°`,
          1,
          'bh',
        )
        break
      }
      case 'transition':
        add('Fitting', comp.name + sys, `${sz(n.w, n.h, n.shape)} → ${sz(n.w2, n.h2, n.shape)}`, 1, 'bh')
        break
      case 'tee':
      case 'takeoff':
        add('Fitting', comp.name + sys, `${sz(n.w, n.h, n.shape)} / cabang ${sz(n.bw, n.bh, n.shape)}`, 1, 'bh')
        break
      case 'endcap':
      case 'damper':
      case 'accessdoor':
        add('Perlengkapan', comp.name + sys, sz(n.w, n.h, n.shape), 1, 'bh')
        break
      case 'diffuser':
      case 'louver':
        add('Perlengkapan', comp.name + sys, `${n.F}×${n.F} mm`, 1, 'bh')
        break
      case 'grille':
        add('Perlengkapan', comp.name + sys, `${n.Fx}×${n.Fy} mm`, 1, 'bh')
        break
      case 'fan':
      case 'fcu':
      case 'outdoor':
        add('Equipment', comp.name, n.tag || '', 1, 'unit')
        break
    }

    if (comp.duct) {
      for (const pr of worldPrims(n, ctx)) {
        if (pr.layer === 'hanger' && pr.k === 'l') hang += 1
      }
    }
  }

  if (hang > 0) {
    add(
      'Perlengkapan',
      'Gantungan duct (rod + support)',
      ctx.hang.sp ? `tiap ${ctx.hang.sp} mm` : '',
      hang,
      'titik',
    )
  }

  return [...rows.values()]
    .map(r => ({
      ...r,
      qty: r.unit === 'm' ? Math.round(r.qty * 10) / 10 : r.qty,
    }))
    .sort((a, b) => (
      BOQ_ORDER.indexOf(a.kat) - BOQ_ORDER.indexOf(b.kat)
      || a.item.localeCompare(b.item)
      || a.spec.localeCompare(b.spec, 'id', { numeric: true })
    ))
}

/** Format jumlah + satuan bergaya angka Indonesia (koma desimal). */
export function formatBoqQty(row: Pick<BoqRow, 'qty' | 'unit'>): string {
  return `${row.qty.toLocaleString('id-ID')} ${row.unit}`
}

/** Ringkasan jumlah baris dan total meter duct dari daftar BOQ. */
export function boqSummary(rows: readonly BoqRow[]): BoqSummary {
  const totalDuctMeters = Math.round(
    rows.filter(r => r.unit === 'm').reduce((sum, r) => sum + r.qty, 0) * 10,
  ) / 10
  return {
    count: rows.length,
    totalDuctMeters,
    label: rows.length > 0
      ? `${rows.length} baris · duct total ${totalDuctMeters.toLocaleString('id-ID')} m`
      : '',
  }
}

/**
 * Ekspor BOQ ke format CSV untuk Excel Indonesia:
 * UTF-8 BOM, pemisah titik koma `;`, dan koma desimal `,`.
 */
export function boqCSV(rows: readonly BoqRow[]): string {
  const table: string[][] = [
    ['Kategori', 'Item', 'Spesifikasi', 'Jumlah', 'Satuan'],
    ...rows.map(r => [r.kat, r.item, r.spec, String(r.qty).replace('.', ','), r.unit]),
  ]
  const escapeCell = (value: string) => (
    /[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
  )
  return `\uFEFF${table.map(row => row.map(escapeCell).join(';')).join('\r\n')}`
}

/** Format daftar material polos untuk ditempel ke WhatsApp atau catatan lapangan. */
export function boqText(projectName: string, rows: readonly BoqRow[]): string {
  const title = projectName.trim() || 'Proyek'
  const lines = rows.map(r => `• ${r.item}${r.spec ? ` ${r.spec}` : ''}: ${formatBoqQty(r)}`)
  return [
    `Daftar material - ${title}`,
    ...lines,
    `(dihitung dari sketsa Temandor; ${BOQ_DISCLAIMER.toLowerCase()} Cek ulang di lapangan)`,
  ].join('\n')
}
