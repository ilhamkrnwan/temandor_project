import { createId, createNode, defaultLayers, LAYER_KEYS, NODE_DEFAULTS, withLayers } from './model'
import { safeParseProject } from './schema'
import type { LayerKey, LayersMap, NodeType, Project, TextColor } from './types'

export const CURRENT_PROJECT_VERSION = 2

export type DetectedProjectVersion = 1 | 2 | 'unsupported-future' | 'invalid'

export interface OpenProjectOptions {
  /** Beri ID proyek baru agar tidak menimpa proyek lokal yang sudah ada (default `true`). */
  freshId?: boolean
}

export type OpenProjectResult
  = | { ok: true, project: Project, migratedFrom: 1 | null }
    | { ok: false, error: string }

const SCALE_PATTERN = /^1:[1-9]\d*$/
const VALID_TEXT_COLORS = new Set<string>(['', 'merah', 'kuning', 'hijau', 'biru', 'putih'])
const VALID_TEXT_ALIGNS = new Set<string>(['start', 'middle', 'end'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isKnownNodeType(type: unknown): type is NodeType {
  return typeof type === 'string' && Object.prototype.hasOwnProperty.call(NODE_DEFAULTS, type)
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function positiveNumber(value: unknown): number | null {
  const n = finiteNumber(value)
  return n !== null && n > 0 ? n : null
}

/** Ubah nama proyek menjadi slug nama file aman (fallback `proyek-temandor`). */
export function projectFileSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'proyek-temandor'
}

/** Nama file `.json` cadangan proyek berdasarkan slug nama proyek. */
export function projectFileName(name: string): string {
  return `${projectFileSlug(name)}.json`
}

/** Serialisasi proyek v2 menjadi string JSON rapi. */
export function serializeProjectJson(project: Project, indent = 2): string {
  return JSON.stringify(project, null, indent)
}

/** Deteksi versi skema dari objek proyek JSON (v1 = prototype tanpa `version`, v2 = format saat ini). */
export function detectProjectVersion(raw: unknown): DetectedProjectVersion {
  if (!isRecord(raw)) return 'invalid'

  if (raw.version === CURRENT_PROJECT_VERSION) return 2
  if (typeof raw.version === 'number') {
    if (raw.version === 1) return 1
    if (raw.version > CURRENT_PROJECT_VERSION) return 'unsupported-future'
    return 'invalid'
  }
  if (raw.version === undefined) {
    if (Array.isArray(raw.nodes)) return 1
    return 'invalid'
  }
  return 'invalid'
}

function migrateLayersV1(rawLayers: unknown): LayersMap {
  const layers = defaultLayers()
  if (!isRecord(rawLayers)) return layers
  for (const key of LAYER_KEYS) {
    const entry = rawLayers[key]
    if (isRecord(entry)) {
      layers[key as LayerKey] = {
        on: Boolean(entry.on),
        lock: Boolean(entry.lock),
      }
    }
  }
  return layers
}

function normalizePoints(rawPts: unknown, minLen: number): Array<[number, number]> | undefined {
  if (!Array.isArray(rawPts)) return undefined
  const pts: Array<[number, number]> = []
  for (const pair of rawPts) {
    if (!Array.isArray(pair) || pair.length < 2) continue
    const x = finiteNumber(pair[0])
    const y = finiteNumber(pair[1])
    if (x !== null && y !== null) pts.push([x, y])
  }
  return pts.length >= minLen ? pts : undefined
}

/**
 * Migrasi murni objek proyek v1 (prototype, memakai `v: 1` atau tanpa `version`) menjadi objek v2.
 * Komponen yang tidak dikenal dilewati dengan aman; properti baru diisi dari default tipe.
 */
export function migrateV1ToV2(raw: Record<string, unknown>): Record<string, unknown> {
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : []
  const usedIds = new Set<string>()
  const idRemap = new Map<string, string>()

  const preliminary: Array<{ type: NodeType, src: Record<string, unknown>, id: string }> = []
  for (const entry of rawNodes) {
    if (!isRecord(entry) || !isKnownNodeType(entry.type)) continue
    const x = finiteNumber(entry.x)
    const y = finiteNumber(entry.y)
    if (x === null || y === null) continue

    const rawId = typeof entry.id === 'string' && entry.id.trim().length > 0 ? entry.id.trim() : null
    let nextId = rawId && !usedIds.has(rawId) ? rawId : createId()
    while (usedIds.has(nextId)) nextId = createId()
    usedIds.add(nextId)
    if (rawId && rawId !== nextId && !idRemap.has(rawId)) {
      idRemap.set(rawId, nextId)
    }
    preliminary.push({ type: entry.type, src: entry, id: nextId })
  }

  const migratedNodes: Record<string, unknown>[] = preliminary.map(({ type, src, id }) => {
    const base = createNode(type) as unknown as Record<string, unknown>
    const out: Record<string, unknown> = {
      ...base,
      ...src,
      id,
      type,
      x: finiteNumber(src.x) ?? 0,
      y: finiteNumber(src.y) ?? 0,
      rot: finiteNumber(src.rot) ?? 0,
      mir: Boolean(src.mir),
    }

    if (src.lock) out.lock = true
    else delete out.lock

    if (typeof src.g === 'string' && src.g.trim().length > 0) out.g = src.g.trim()
    else delete out.g

    if (type === 'straight') {
      out.flip = Boolean(src.flip)
    }

    if (type === 'elbow') {
      out.w2 = src.w2 == null ? null : (positiveNumber(src.w2) ?? null)
      out.h2 = src.h2 == null ? null : (positiveNumber(src.h2) ?? null)
      out.et = src.et === 'sq' ? 'sq' : 'r'
      out.rr = src.rr === 1.5 || src.rr === '1.5' ? '1.5' : '1'
    }

    if (type === 'room') {
      out.dims = src.dims !== false
      const pts = normalizePoints(src.pts, 3)
      if (pts) out.pts = pts
      else delete out.pts
    }

    if (type === 'sketch') {
      const pts = normalizePoints(src.pts, 2)
      if (pts) out.pts = pts
    }

    if (type === 'text' || type === 'note') {
      const tz = src.tz != null && String(src.tz).trim() ? String(src.tz).trim() : '1'
      out.tz = tz
      out.th = finiteNumber(src.th) !== null && Number(src.th) >= 0 ? Number(src.th) : 0
      out.col = (typeof src.col === 'string' && VALID_TEXT_COLORS.has(src.col) ? src.col : '') as TextColor
      out.b = Boolean(src.b)
      out.it = Boolean(src.it)
      out.ul = Boolean(src.ul)
      out.bx = Boolean(src.bx)
      if (type === 'text') {
        out.al = typeof src.al === 'string' && VALID_TEXT_ALIGNS.has(src.al) ? src.al : 'start'
      }
    }

    if (type === 'door' || type === 'win' || type === 'opening') {
      if (isRecord(src.host)) {
        const rawHostId = typeof src.host.id === 'string' ? src.host.id.trim() : ''
        const hostId = idRemap.get(rawHostId) ?? rawHostId
        const e = finiteNumber(src.host.e)
        const s = finiteNumber(src.host.s)
        const n = finiteNumber(src.host.n)
        if (hostId && e !== null && e >= 0 && s !== null && n !== null && n >= 3) {
          out.host = { id: hostId, e: Math.trunc(e), s, n: Math.trunc(n) }
        }
        else {
          delete out.host
        }
      }
      else {
        delete out.host
      }
    }

    return out
  })

  const rawHang = isRecord(raw.hang) ? raw.hang : null
  const rawName = typeof raw.name === 'string' ? raw.name.trim() : ''
  const rawScale = typeof raw.scale === 'string' ? raw.scale.trim() : ''
  const rawUpdated = finiteNumber(raw.updated)

  return {
    version: CURRENT_PROJECT_VERSION,
    id: typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id.trim() : createId(),
    name: rawName || 'Proyek impor',
    unit: raw.unit === 'mm' ? 'mm' : 'inch',
    scale: SCALE_PATTERN.test(rawScale) ? rawScale : '1:100',
    fu: raw.fu === 'l/s' ? 'l/s' : 'cfm',
    updated: rawUpdated !== null && rawUpdated >= 0 ? rawUpdated : Date.now(),
    hang: {
      on: rawHang ? Boolean(rawHang.on) : true,
      sp: positiveNumber(rawHang?.sp) ?? 1500,
    },
    layers: migrateLayersV1(raw.layers),
    nodes: migratedNodes,
  }
}

/**
 * Validasi dan migrasi objek proyek (v1 atau v2) menjadi `Project` v2 yang lolos skema Zod.
 * Tidak pernah melempar error; mengembalikan pesan kesalahan yang jelas bila file rusak.
 */
export function migrateProjectData(
  raw: unknown,
  options: OpenProjectOptions = {},
): OpenProjectResult {
  const freshId = options.freshId ?? true
  const detected = detectProjectVersion(raw)

  if (detected === 'invalid') {
    return {
      ok: false,
      error: 'File bukan proyek Temandor yang valid. Pastikan memilih file .json hasil export dari Temandor.',
    }
  }

  if (detected === 'unsupported-future') {
    const futureVer = isRecord(raw) ? String(raw.version) : '?'
    return {
      ok: false,
      error: `File proyek ini memakai format versi ${futureVer} yang lebih baru dari aplikasi ini. Perbarui Temandor terlebih dahulu.`,
    }
  }

  const candidate = detected === 1 ? migrateV1ToV2(raw as Record<string, unknown>) : raw
  const parsed = safeParseProject(candidate)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    const location = first && first.path.length > 0 ? ` (${first.path.join('.')})` : ''
    return {
      ok: false,
      error: `Struktur file proyek Temandor rusak atau tidak lengkap${location}. Periksa kembali file .json yang dibuka.`,
    }
  }

  const normalized = withLayers(parsed.data)
  return {
    ok: true,
    project: freshId
      ? { ...normalized, id: createId(), updated: Date.now() }
      : normalized,
    migratedFrom: detected === 1 ? 1 : null,
  }
}

/** Parse teks `.json` mentah -> deteksi versi -> migrasi v1 -> v2 -> validasi Zod. */
export function openProjectJson(
  rawText: string,
  options: OpenProjectOptions = {},
): OpenProjectResult {
  let raw: unknown
  try {
    raw = JSON.parse(rawText)
  }
  catch {
    return {
      ok: false,
      error: 'File rusak atau bukan format JSON yang valid.',
    }
  }
  return migrateProjectData(raw, options)
}
