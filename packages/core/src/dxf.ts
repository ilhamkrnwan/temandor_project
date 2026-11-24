import { connect, ctxOf, layerOf, projectBounds, worldPrims } from './components'
import { rotP } from './geom'
import { LAYER_KEYS, LAYERS } from './model'
import type { LayerKey, Point, Project, TextColor, Unit } from './types'

type ColoredTextKey = Exclude<TextColor, ''>

/** Peta warna pilihan teks/catatan ke nomor warna AutoCAD Color Index (ACI). */
export const PICK_ACI: Readonly<Record<ColoredTextKey, number>> = {
  merah: 1,
  kuning: 2,
  hijau: 3,
  biru: 5,
  putih: 7,
}

export interface DxfExportOptions {
  /** Layer yang diikutkan (default: layer yang aktif tampil di proyek). */
  layers?: ReadonlySet<LayerKey>
  /** Satuan model DXF (`mm` atau `inch`, default `mm`). */
  unit?: Unit
  /** Sertakan catatan "SKETSA BANTU TEMANDOR - CEK ULANG UKURAN DI LAPANGAN" di bawah gambar (default `true`). */
  note?: boolean
}

const LAYER_DXF_NAME: Readonly<Record<LayerKey, string>> = Object.fromEntries(
  LAYERS.map(layer => [layer.key, layer.dxf]),
) as Record<LayerKey, string>

const ALIGN_CODE: Readonly<Record<'start' | 'middle' | 'end', number>> = {
  start: 0,
  middle: 1,
  end: 2,
}

/** Normalisasi teks ke ASCII aman untuk DXF R12 (simbol Ø -> %%c, ° -> %%d, ² -> 2). */
function sanitizeDxfText(raw: string): string {
  return String(raw)
    .replace(/Ø/g, '%%c')
    .replace(/°/g, '%%d')
    .replace(/²/g, '2')
    .replace(/[^\x20-\x7e]/g, '')
}

/**
 * Tulis file DXF R12 (AC1009, ASCII) langsung dari primitive geometri yang sama dengan tampilan layar.
 * Koordinat Y dibalik ke atas (konvensi CAD). Mendukung LINE, ARC, CIRCLE, SOLID, TEXT, layer + warna ACI,
 * serta linetype DASHED untuk balok dan bukaan.
 */
export function toDXF(project: Project, options: DxfExportOptions = {}): string {
  const unit: Unit = options.unit ?? 'mm'
  const includeNote = options.note ?? true
  const activeLayers: ReadonlySet<LayerKey> = options.layers
    ?? new Set(LAYER_KEYS.filter(key => project.layers[key]?.on !== false))

  const cn = connect(project)
  const ctx = ctxOf(project, cn)
  const scale = unit === 'inch' ? 1 / 25.4 : 1

  const fmt = (v: number): string => (Math.round(v * scale * 1000) / 1000).toString()
  const fmtY = (v: number): string => fmt(-v)
  const fmtAng = (deg: number): string => (((deg % 360) + 360) % 360).toFixed(3)

  const entities: Array<string | number> = []
  const put = (...kv: Array<string | number>) => {
    for (let i = 0; i < kv.length; i += 2) {
      entities.push(kv[i]!, kv[i + 1]!)
    }
  }
  const emitLine = (layer: string, a: Point, b: Point) => {
    put(0, 'LINE', 8, layer, 10, fmt(a[0]), 20, fmtY(a[1]), 11, fmt(b[0]), 21, fmtY(b[1]))
  }
  const emitLoop = (layer: string, pts: readonly Point[], closed?: boolean) => {
    const count = pts.length - (closed ? 0 : 1)
    for (let i = 0; i < count; i++) {
      emitLine(layer, pts[i]!, pts[(i + 1) % pts.length]!)
    }
  }

  for (const node of project.nodes) {
    for (const pr of worldPrims(node, ctx)) {
      const key: LayerKey = pr.layer ?? layerOf(node)
      if (!activeLayers.has(key) || pr.k === 'hit' || pr.nostroke) continue

      const dxfLayer = pr.k === 't' && key !== 'dim' ? 'TEXT' : LAYER_DXF_NAME[key]
      const start = entities.length

      switch (pr.k) {
        case 'l':
          emitLine(dxfLayer, pr.a, pr.b)
          break
        case 'pl':
          emitLoop(dxfLayer, pr.pts, pr.closed)
          break
        case 'ring':
          emitLoop(dxfLayer, pr.outer, true)
          emitLoop(dxfLayer, pr.inner, true)
          break
        case 'c':
          put(0, 'CIRCLE', 8, dxfLayer, 10, fmt(pr.c[0]), 20, fmtY(pr.c[1]), 40, fmt(pr.r))
          break
        case 'arc':
          put(
            0, 'ARC',
            8, dxfLayer,
            10, fmt(pr.c[0]),
            20, fmtY(pr.c[1]),
            40, fmt(pr.r),
            50, fmtAng(-pr.a1),
            51, fmtAng(-pr.a0),
          )
          break
        case 'arrow': {
          const u = rotP([1, 0], pr.dir)
          const v: Point = [-u[1], u[0]]
          const h = pr.h
          const tip: Point = [pr.p[0] + (u[0] * h) / 2, pr.p[1] + (u[1] * h) / 2]
          const base: Point = [pr.p[0] - (u[0] * h) / 2, pr.p[1] - (u[1] * h) / 2]
          const p1: Point = [base[0] + v[0] * h * 0.35, base[1] + v[1] * h * 0.35]
          const p2: Point = [base[0] - v[0] * h * 0.35, base[1] - v[1] * h * 0.35]
          put(
            0, 'SOLID',
            8, dxfLayer,
            10, fmt(tip[0]), 20, fmtY(tip[1]),
            11, fmt(p1[0]), 21, fmtY(p1[1]),
            12, fmt(p2[0]), 22, fmtY(p2[1]),
            13, fmt(p2[0]), 23, fmtY(p2[1]),
          )
          break
        }
        case 't': {
          const align = ALIGN_CODE[pr.anchor] ?? 0
          const x = fmt(pr.p[0])
          const y = fmtY(pr.p[1])
          put(
            0, 'TEXT',
            8, dxfLayer,
            10, x,
            20, y,
            40, fmt(pr.h),
            1, (pr.ul ? '%%u' : '') + sanitizeDxfText(pr.s),
            50, fmtAng(-pr.rot),
          )
          if (pr.it) put(51, '15.000')
          if (align) put(72, align, 11, x, 21, y)
          break
        }
      }

      // Sisipkan atribut warna pilihan (kode 62) dan garis putus-putus (kode 6) setelah layer tiap entitas.
      const aci = pr.col ? PICK_ACI[pr.col] : undefined
      const dashed = Boolean(pr.dash)
      if (aci || dashed) {
        for (let i = start; i < entities.length; i += 2) {
          if (entities[i] !== 8) continue
          const extras: Array<string | number> = []
          if (aci) extras.push(62, aci)
          if (dashed) extras.push(6, 'DASHED')
          entities.splice(i + 2, 0, ...extras)
          i += extras.length
        }
      }
    }
  }

  if (includeNote) {
    const b = projectBounds(project, ctx)
    put(
      0, 'TEXT',
      8, 'TEXT',
      10, fmt(b[0]),
      20, fmtY(b[3] + ctx.th * 3),
      40, fmt(ctx.th),
      1, sanitizeDxfText(`SKETSA BANTU TEMANDOR - CEK ULANG UKURAN DI LAPANGAN. ${project.name} (${project.scale}, duct ${project.unit})`),
    )
  }

  // Panjang pola DASHED disesuaikan satuan model sehingga tampak rapi di AutoCAD pada skala 1:100
  // dan kode 40 selalu tepat sama dengan |dash| + |gap|.
  const dashLenNum = Math.round(120 * scale * 1000) / 1000
  const gapLenNum = Math.round(60 * scale * 1000) / 1000
  const totalDashLen = (Math.round((dashLenNum + gapLenNum) * 1000) / 1000).toString()

  const layerRows: Array<[string, number]> = [
    ...LAYERS.map((layer): [string, number] => [layer.dxf, layer.aci]),
    ['TEXT', 7],
  ]

  const head: Array<string | number> = [
    0, 'SECTION',
    2, 'HEADER',
    9, '$ACADVER', 1, 'AC1009',
    9, '$INSUNITS', 70, unit === 'inch' ? 1 : 4,
    0, 'ENDSEC',
    0, 'SECTION',
    2, 'TABLES',
    0, 'TABLE',
    2, 'LTYPE',
    70, 2,
    0, 'LTYPE', 2, 'CONTINUOUS', 70, 0, 3, 'Solid line', 72, 65, 73, 0, 40, '0.0',
    0, 'LTYPE', 2, 'DASHED', 70, 0, 3, 'Dashed __ __ __ __', 72, 65, 73, 2, 40, totalDashLen, 49, dashLenNum.toString(), 49, (-gapLenNum).toString(),
    0, 'ENDTAB',
    0, 'TABLE',
    2, 'LAYER',
    70, layerRows.length,
    ...layerRows.flatMap(([nm, col]) => [0, 'LAYER', 2, nm, 70, 0, 62, col, 6, 'CONTINUOUS']),
    0, 'ENDTAB',
    0, 'ENDSEC',
    0, 'SECTION',
    2, 'ENTITIES',
  ]

  return `${[...head, ...entities, 0, 'ENDSEC', 0, 'EOF'].join('\n')}\n`
}
