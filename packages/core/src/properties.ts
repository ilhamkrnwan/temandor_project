import {
  ELBOW_ANGLE_CHIPS,
  ELBOW_RADIUS_RATIOS,
  clampElbowAngle,
  componentOf,
  worldPorts,
  type ConnectionGraph,
} from './components'
import type { DuctSpec } from './ductPath'
import { norm, sizeLabel } from './geom'
import { TEXT_ALIGN_OPTIONS, TEXT_COLOR_OPTIONS, TEXT_SIZE_OPTIONS, TEXT_STYLE_FLAGS } from './markupTools'
import { resizeRoom } from './room'
import { isNodeLocked } from './select'
import type { AlignDirection } from './transform'
import type { Node, NodeType, Project } from './types'

export type PropertyFieldId
  = | 'sys'
    | 'size'
    | 'size2'
    | 'bsize'
    | 'L'
    | 'angle'
    | 'elev'
    | 'et'
    | 'rr'
    | 'tz'
    | 'col'
    | 'al'
    | 'sty'
    | 'flow'
    | 'tag'
    | 'F'
    | 'Fx'
    | 'Fy'
    | 'B'
    | 'name'
    | 'W'
    | 'H'
    | 't'
    | 'off'
    | 'dims'
    | 's'
    | 'th'
    | 'shape'
    | 'cw'
    | 'cd'
    | 'kind'
    | 'dw'
    | 'swing'
    | 'hinge'
    | 'sw'
    | 'sd'
    | 'bw'
    | 'be'
    | 'skind'
    | 'sl'
    | 'tr'
    | 'ch'

export type NodePropKey
  = | 'sys'
    | 'shape'
    | 'w'
    | 'h'
    | 'w2'
    | 'h2'
    | 'bw'
    | 'bh'
    | 'L'
    | 'angle'
    | 'elev'
    | 'et'
    | 'rr'
    | 'rot'
    | 'flip'
    | 'flow'
    | 'tag'
    | 'F'
    | 'Fx'
    | 'Fy'
    | 'B'
    | 'name'
    | 'W'
    | 'H'
    | 't'
    | 'off'
    | 'dims'
    | 's'
    | 'th'
    | 'tz'
    | 'col'
    | 'al'
    | 'b'
    | 'it'
    | 'ul'
    | 'bx'
    | 'cw'
    | 'cd'
    | 'kind'
    | 'dw'
    | 'swing'
    | 'hinge'
    | 'sw'
    | 'sd'
    | 'be'
    | 'skind'
    | 'sl'
    | 'tr'
    | 'ch'

export interface PropertyOption {
  readonly value: string
  readonly label: string
}

export type PropertyFieldMeta
  = | { kind: 'sys', label: string, options: readonly PropertyOption[] }
    | { kind: 'size', label: string, keys: readonly [NodePropKey, NodePropKey] }
    | { kind: 'num', label: string, key: NodePropKey, unit: 'mm' | 'flow' }
    | { kind: 'ang', label: string, key: 'angle', presets: readonly number[] }
    | { kind: 'opt', label: string, key: NodePropKey, options: readonly PropertyOption[] }
    | { kind: 'chk', label: string, key: 'dims', checkLabel: string }
    | { kind: 'text', label: string, key: NodePropKey }
    | { kind: 'col', label: string }
    | { kind: 'sty', label: string }

export const SYSTEM_OPTIONS: readonly PropertyOption[] = [
  { value: 'SA', label: 'Supply (SA)' },
  { value: 'EA', label: 'Exhaust (EA)' },
]

export const SHAPE_OPTIONS: readonly PropertyOption[] = [
  { value: 'rect', label: 'Kotak' },
  { value: 'round', label: 'Bulat' },
]

export const ELBOW_TYPE_OPTIONS: readonly PropertyOption[] = [
  { value: 'r', label: 'Radius' },
  { value: 'sq', label: 'Siku + vane' },
]

export const ALIGN_PROPERTY_OPTIONS: ReadonlyArray<{
  direction: AlignDirection
  label: string
  path: string
}> = [
  { direction: 'left', label: 'Rata kiri', path: 'M4 3v18M8 7h10v4H8zM8 13h6v4H8z' },
  { direction: 'center', label: 'Rata tengah (horizontal)', path: 'M12 3v18M6 7h12v4H6zM8 13h8v4H8z' },
  { direction: 'right', label: 'Rata kanan', path: 'M20 3v18M6 7h10v4H6zM10 13h6v4h-6z' },
  { direction: 'top', label: 'Rata atas', path: 'M3 4h18M7 8h4v10H7zM13 8h4v6h-4z' },
  { direction: 'middle', label: 'Rata tengah (vertikal)', path: 'M3 12h18M7 6h4v12H7zM13 8h4v8h-4z' },
  { direction: 'bottom', label: 'Rata bawah', path: 'M3 20h18M7 6h4v10H7zM13 10h4v6h-4z' },
]

export const PROPERTY_FIELD_META: Record<PropertyFieldId, PropertyFieldMeta> = {
  sys: { kind: 'sys', label: 'Sistem', options: SYSTEM_OPTIONS },
  size: { kind: 'size', label: 'Ukuran', keys: ['w', 'h'] },
  size2: { kind: 'size', label: 'Ukuran ujung b', keys: ['w2', 'h2'] },
  bsize: { kind: 'size', label: 'Ukuran cabang', keys: ['bw', 'bh'] },
  L: { kind: 'num', label: 'Panjang', key: 'L', unit: 'mm' },
  angle: { kind: 'ang', label: 'Sudut belok (5-150°)', key: 'angle', presets: ELBOW_ANGLE_CHIPS },
  elev: { kind: 'num', label: 'Elevasi dasar duct (BOD)', key: 'elev', unit: 'mm' },
  et: { kind: 'opt', label: 'Tipe elbow', key: 'et', options: ELBOW_TYPE_OPTIONS },
  rr: {
    kind: 'opt',
    label: 'Radius (R / lebar)',
    key: 'rr',
    options: ELBOW_RADIUS_RATIOS.map(r => ({ value: r, label: r === '1' ? '1,0 × W' : '1,5 × W' })),
  },
  tz: { kind: 'opt', label: 'Ukuran teks', key: 'tz', options: TEXT_SIZE_OPTIONS },
  col: { kind: 'col', label: 'Warna' },
  al: { kind: 'opt', label: 'Rata', key: 'al', options: TEXT_ALIGN_OPTIONS },
  sty: { kind: 'sty', label: 'Gaya' },
  flow: { kind: 'num', label: 'Debit', key: 'flow', unit: 'flow' },
  tag: { kind: 'text', label: 'Kode', key: 'tag' },
  F: { kind: 'num', label: 'Ukuran muka', key: 'F', unit: 'mm' },
  Fx: { kind: 'num', label: 'Muka - lebar', key: 'Fx', unit: 'mm' },
  Fy: { kind: 'num', label: 'Muka - panjang', key: 'Fy', unit: 'mm' },
  B: { kind: 'num', label: 'Lebar badan', key: 'B', unit: 'mm' },
  name: { kind: 'text', label: 'Nama ruangan', key: 'name' },
  W: { kind: 'num', label: 'Panjang', key: 'W', unit: 'mm' },
  H: { kind: 'num', label: 'Lebar', key: 'H', unit: 'mm' },
  t: { kind: 'num', label: 'Tebal dinding', key: 't', unit: 'mm' },
  off: { kind: 'num', label: 'Jarak garis ukur', key: 'off', unit: 'mm' },
  dims: { kind: 'chk', label: 'Ukuran otomatis', key: 'dims', checkLabel: 'Tampilkan garis ukur' },
  s: { kind: 'text', label: 'Isi teks', key: 's' },
  th: { kind: 'num', label: 'Tinggi khusus (0 = ikut ukuran di atas)', key: 'th', unit: 'mm' },
  shape: { kind: 'opt', label: 'Bentuk', key: 'shape', options: SHAPE_OPTIONS },
  cw: { kind: 'num', label: 'Lebar / diameter kolom', key: 'cw', unit: 'mm' },
  cd: { kind: 'num', label: 'Tebal kolom (kotak)', key: 'cd', unit: 'mm' },
  kind: {
    kind: 'opt',
    label: 'Jenis pintu',
    key: 'kind',
    options: [
      { value: 'single', label: 'Tunggal' },
      { value: 'double', label: 'Ganda' },
      { value: 'sliding', label: 'Geser' },
    ],
  },
  dw: { kind: 'num', label: 'Lebar bukaan', key: 'dw', unit: 'mm' },
  swing: {
    kind: 'opt',
    label: 'Arah buka',
    key: 'swing',
    options: [
      { value: 'in', label: 'Ke dalam' },
      { value: 'out', label: 'Ke luar' },
    ],
  },
  hinge: {
    kind: 'opt',
    label: 'Engsel',
    key: 'hinge',
    options: [
      { value: 'l', label: 'Kiri' },
      { value: 'r', label: 'Kanan' },
    ],
  },
  sw: { kind: 'num', label: 'Lebar', key: 'sw', unit: 'mm' },
  sd: { kind: 'num', label: 'Panjang', key: 'sd', unit: 'mm' },
  bw: { kind: 'num', label: 'Lebar balok', key: 'bw', unit: 'mm' },
  be: { kind: 'num', label: 'Tinggi bawah balok (BB)', key: 'be', unit: 'mm' },
  skind: {
    kind: 'opt',
    label: 'Jenis tangga',
    key: 'skind',
    options: [
      { value: 'straight', label: 'Lurus' },
      { value: 'L', label: 'Bentuk L' },
    ],
  },
  sl: { kind: 'num', label: 'Panjang lajur', key: 'sl', unit: 'mm' },
  tr: { kind: 'num', label: 'Lebar anak tangga', key: 'tr', unit: 'mm' },
  ch: { kind: 'num', label: 'Tinggi plafon', key: 'ch', unit: 'mm' },
}

export const COMPONENT_FIELDS: Record<NodeType, readonly PropertyFieldId[]> = {
  straight: ['sys', 'size', 'L', 'elev'],
  flex: ['sys', 'size', 'L', 'elev'],
  elbow: ['sys', 'size', 'size2', 'angle', 'et', 'rr', 'elev'],
  transition: ['sys', 'size', 'size2', 'L', 'elev'],
  tee: ['sys', 'size', 'bsize', 'elev'],
  takeoff: ['sys', 'size', 'bsize', 'elev'],
  endcap: ['sys', 'size'],
  damper: ['sys', 'size', 'L'],
  accessdoor: ['sys', 'size', 'L'],
  diffuser: ['sys', 'tag', 'flow', 'F'],
  grille: ['sys', 'tag', 'flow', 'Fx', 'Fy'],
  louver: ['sys', 'tag', 'F'],
  fan: ['sys', 'tag', 'L', 'B'],
  fcu: ['tag', 'L', 'B', 'size'],
  outdoor: ['tag', 'L', 'B'],
  room: ['name', 'W', 'H', 't', 'dims'],
  dim: ['off'],
  column: ['shape', 'cw', 'cd'],
  door: ['kind', 'dw', 'swing', 'hinge'],
  win: ['dw'],
  opening: ['dw'],
  partition: ['L', 't'],
  shaft: ['sw', 'sd'],
  beam: ['L', 'bw', 'be'],
  stair: ['skind', 'sl', 'sw', 'tr'],
  lift: ['sw', 'sd'],
  ceiling: ['ch'],
  sketch: [],
  text: ['s', 'tz', 'th', 'col', 'al', 'sty'],
  note: ['s', 'tz', 'th', 'col', 'sty'],
}

/** Daftar field properti yang aktif ditampilkan untuk satu node tertentu. */
export function visibleFieldsForNode(node: Node): PropertyFieldId[] {
  return COMPONENT_FIELDS[node.type].filter((fieldId) => {
    if (fieldId === 'rr' && node.type === 'elbow' && node.et === 'sq') return false
    if (fieldId === 'cd' && node.type === 'column' && node.shape === 'round') return false
    if (node.type === 'door') {
      if (node.kind === 'sliding' && (fieldId === 'swing' || fieldId === 'hinge')) return false
      if (node.kind === 'double' && fieldId === 'hinge') return false
    }
    return true
  })
}

/** Parse input angka dengan koma atau titik desimal (`"22,5"` -> `22.5`). */
export function parseDecimalInput(raw: string | number): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  const normalized = raw.trim().replace(',', '.')
  if (!normalized || !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

/** Format angka properti untuk tampilan input (maks. 2 desimal, koma desimal Indonesia). */
export function formatPropNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 100) / 100
  return String(Object.is(rounded, -0) ? 0 : rounded).replace('.', ',')
}

const POSITIVE_NUMERIC_PROPS = new Set<NodePropKey>([
  'w', 'h', 'w2', 'h2', 'bw', 'bh',
  'L', 'F', 'Fx', 'Fy', 'B', 'W', 'H', 't',
  'cw', 'cd', 'dw', 'sw', 'sd', 'be', 'sl', 'tr', 'ch',
])

const NON_NEGATIVE_NUMERIC_PROPS = new Set<NodePropKey>(['flow', 'th'])
const ANY_NUMERIC_PROPS = new Set<NodePropKey>(['rot', 'off', 'elev', 'angle'])

export interface PropertyUpdateResult {
  changed: boolean
  error?: string
  warning?: string
}

/** Terapkan satu perubahan properti ke seluruh node terpilih yang tidak terkunci (in-place pada draft). */
export function applyPropertyToNodes(
  project: Project,
  ids: ReadonlySet<string>,
  key: NodePropKey,
  rawValue: unknown,
): PropertyUpdateResult {
  let value: unknown = rawValue
  let warning: string | undefined

  const isNumeric = POSITIVE_NUMERIC_PROPS.has(key)
    || NON_NEGATIVE_NUMERIC_PROPS.has(key)
    || ANY_NUMERIC_PROPS.has(key)

  if (isNumeric) {
    const parsed = typeof rawValue === 'string' || typeof rawValue === 'number'
      ? parseDecimalInput(rawValue)
      : null
    if (parsed === null) {
      return { changed: false, error: 'Masukkan angka yang valid' }
    }
    if (POSITIVE_NUMERIC_PROPS.has(key) && !(parsed > 0)) {
      return { changed: false, error: 'Nilai harus lebih dari 0' }
    }
    if (NON_NEGATIVE_NUMERIC_PROPS.has(key) && parsed < 0) {
      return { changed: false, error: 'Nilai tidak boleh negatif' }
    }
    if (key === 'rot') {
      value = norm(parsed)
    }
    else if (key === 'angle') {
      const clamped = clampElbowAngle(parsed)
      if (clamped !== parsed) warning = 'Sudut elbow 5-150°'
      value = clamped
    }
    else {
      value = parsed
    }
  }

  let changed = false
  for (const node of project.nodes) {
    if (!ids.has(node.id) || isNodeLocked(project, node)) continue

    if (node.type === 'room' && (key === 'W' || key === 'H')) {
      const prevW = node.W
      const prevH = node.H
      resizeRoom(node, key, value as number)
      if (node.W !== prevW || node.H !== prevH) changed = true
      continue
    }

    if (node.type === 'elbow' && (key === 'w2' || key === 'h2')) {
      const prevW2 = node.w2
      const prevH2 = node.h2
      if (node.w2 == null || node.h2 == null) {
        node.w2 = node.w
        node.h2 = node.h
      }
      if (key === 'w2') node.w2 = value as number
      else node.h2 = value as number
      if (node.w2 === node.w && node.h2 === node.h) {
        node.w2 = null
        node.h2 = null
      }
      if (node.w2 !== prevW2 || node.h2 !== prevH2) changed = true
      continue
    }

    if (key === 'rot') {
      const nextRot = value as number
      if ((node.rot || 0) !== nextRot) {
        node.rot = nextRot
        changed = true
      }
      continue
    }

    if (!(key in node)) continue
    const record = node as unknown as Record<string, unknown>
    if (record[key] !== value) {
      record[key] = value
      changed = true
    }
  }

  return { changed, warning }
}

/** Validasi & terapkan perubahan parameter pada `DuctSpec` untuk duct yang akan digambar. */
export function applyDuctSpecProperty(
  spec: DuctSpec,
  key: 'sys' | 'shape' | 'w' | 'h' | 'elev',
  rawValue: unknown,
): { next: DuctSpec, error?: string } {
  if (key === 'sys' && (rawValue === 'SA' || rawValue === 'EA')) {
    return { next: { ...spec, sys: rawValue } }
  }
  if (key === 'shape' && (rawValue === 'rect' || rawValue === 'round')) {
    return { next: { ...spec, shape: rawValue } }
  }
  const parsed = typeof rawValue === 'string' || typeof rawValue === 'number'
    ? parseDecimalInput(rawValue)
    : null
  if (parsed === null) {
    return { next: spec, error: 'Masukkan angka yang valid' }
  }
  if ((key === 'w' || key === 'h') && !(parsed > 0)) {
    return { next: spec, error: 'Nilai harus lebih dari 0' }
  }
  return { next: { ...spec, [key]: parsed } }
}

export interface NodePortSummary {
  id: string
  connected: boolean
  optional: boolean
  statusText: string
  sizeText: string | null
}

/** Ringkasan status sambungan tiap port pada satu node untuk bagian Sambungan di panel Properti. */
export function nodePortSummaries(
  node: Node,
  project: Project,
  cn: ConnectionGraph,
): NodePortSummary[] {
  const ports = cn.all.filter(p => p.node.id === node.id)
  if (ports.length === 0) {
    return worldPorts(node, project.unit).map(p => ({
      id: p.id,
      connected: false,
      optional: Boolean(p.opt),
      statusText: p.opt ? 'boleh kosong' : 'belum tersambung',
      sizeText: p.keys && p.w != null && p.h != null && p.shape
        ? sizeLabel(p.w, p.h, p.shape, project.unit)
        : null,
    }))
  }
  return ports.map((p) => {
    const linked = cn.link.get(p)
    return {
      id: p.id,
      connected: Boolean(linked),
      optional: Boolean(p.opt),
      statusText: linked
        ? `ke ${componentOf(linked.node.type).name}`
        : p.opt
          ? 'boleh kosong'
          : 'belum tersambung',
      sizeText: p.keys && p.w != null && p.h != null && p.shape
        ? sizeLabel(p.w, p.h, p.shape, project.unit)
        : null,
    }
  })
}

export { TEXT_COLOR_OPTIONS, TEXT_STYLE_FLAGS }
