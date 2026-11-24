import { RAD, rotP, type Bounds } from './geom'
import type { RenderCtx } from './prims'
import { LAYERS } from './model'
import { connect, ctxOf, layerOf, projectBounds, worldPrims } from './components'
import type { LayerKey, LayersMap, Node, Point, Prim, Project, TextColor } from './types'

export type PaletteName = 'screen' | 'paper' | 'light'

type PickColorKey = Exclude<TextColor, ''>

export interface Palette {
  readonly bg: string
  readonly wall: string
  readonly col: Readonly<Record<LayerKey, string>>
  readonly lbl: Readonly<Record<LayerKey, string>>
  readonly pick: Readonly<Record<PickColorKey, string>>
}

const SCREEN_PALETTE: Palette = {
  bg: '#14171b',
  wall: '#242930',
  col: {
    sa: '#4ea1ff',
    ea: '#f472b6',
    eq: '#4ade80',
    diff: '#22d3ee',
    hanger: '#8b95a3',
    dim: '#9aa3ad',
    denah: '#6b7480',
    kolom: '#a3acb8',
    bukaan: '#c4b5fd',
    arsi: '#8792a0',
    coret: '#fb923c',
  },
  lbl: {
    sa: '#9cc8ff',
    ea: '#f9a8d4',
    eq: '#86efac',
    diff: '#67e8f9',
    hanger: '#8b95a3',
    dim: '#c3c9d0',
    denah: '#7d8692',
    kolom: '#c3c9d0',
    bukaan: '#ddd6fe',
    arsi: '#aab3bf',
    coret: '#fdba74',
  },
  pick: {
    merah: '#f87171',
    kuning: '#facc15',
    hijau: '#4ade80',
    biru: '#60a5fa',
    putih: '#f3f4f6',
  },
}

const PAPER_PALETTE: Palette = {
  bg: '#ffffff',
  wall: '#e8ebef',
  col: {
    sa: '#1d4ed8',
    ea: '#be185d',
    eq: '#15803d',
    diff: '#0e7490',
    hanger: '#64748b',
    dim: '#334155',
    denah: '#475569',
    kolom: '#1e293b',
    bukaan: '#6d28d9',
    arsi: '#64748b',
    coret: '#c2410c',
  },
  lbl: {
    sa: '#1d4ed8',
    ea: '#be185d',
    eq: '#15803d',
    diff: '#0e7490',
    hanger: '#64748b',
    dim: '#1e293b',
    denah: '#475569',
    kolom: '#1e293b',
    bukaan: '#6d28d9',
    arsi: '#475569',
    coret: '#c2410c',
  },
  pick: {
    merah: '#dc2626',
    kuning: '#a16207',
    hijau: '#15803d',
    biru: '#1d4ed8',
    putih: '#111827',
  },
}

export const PAL: Readonly<Record<PaletteName, Palette>> = {
  screen: SCREEN_PALETTE,
  paper: PAPER_PALETTE,
  light: { ...PAPER_PALETTE, bg: '#f6f7f9', wall: '#e2e6eb' },
}

/** Urutan gambar per layer dari paling bawah (`denah`) sampai paling atas (`coret`). */
export const DRAW_ORDER: readonly LayerKey[] = [
  'denah',
  'arsi',
  'kolom',
  'bukaan',
  'dim',
  'hanger',
  'eq',
  'diff',
  'sa',
  'ea',
  'coret',
] as const

export interface SvgRenderOptions {
  pal: PaletteName
  sw: number
  live?: boolean
  sel?: ReadonlySet<string>
}

export interface DocSvgOptions {
  pal?: PaletteName
  layers?: ReadonlySet<LayerKey> | null
  note?: boolean
  sw?: number
}

export interface DocSvgResult {
  vb: Bounds
  svg: string
}

export type SvgRenderItem
  = | {
    tag: 'path'
    d: string
    className?: string
    stroke: string
    strokeWidth?: number
    fill: string
    fillRule?: 'evenodd'
    strokeDasharray?: string
  }
  | {
    tag: 'circle'
    cx: number
    cy: number
    r: number
    className?: string
    stroke: string
    strokeWidth?: number
    fill: string
    strokeDasharray?: string
  }
  | {
    tag: 'text'
    x: number
    y: number
    fontSize: number
    textAnchor: string
    fill: string
    fontWeight?: string
    fontStyle?: string
    textDecoration?: string
    transform?: string
    text: string
  }

export function f1(v: number): number {
  return Math.round(v * 10) / 10
}

export function escXml(s: string): string {
  return String(s).replace(/[&<>"]/g, (ch) => {
    switch (ch) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      default: return ch
    }
  })
}

export function ptsPath(pts: readonly Point[], close?: boolean): string {
  return `M${pts.map(p => `${f1(p[0])} ${f1(p[1])}`).join('L')}${close ? 'Z' : ''}`
}

/**
 * Konversi satu `Prim` menjadi deskripsi elemen SVG terstruktur.
 * Dipakai bersama oleh `primSVG()` (string export) dan `<CadNode>` (render reaktif Vue).
 */
export function primToRenderItem(pr: Prim, layer: LayerKey, opts: SvgRenderOptions): SvgRenderItem | null {
  const pal = PAL[opts.pal]

  if (pr.k === 'hit') {
    if (!opts.live) return null
    return {
      tag: 'path',
      className: 'hit',
      d: ptsPath(pr.pts, true),
      fill: 'transparent',
      stroke: 'none',
    }
  }

  const col = pr.col ? pal.pick[pr.col] : pal.col[layer]
  const w = opts.sw * (pr.j ? 0.65 : 1)
  const swRounded = f1(w * 100) / 100
  const fill = pr.fill === 'wall' ? pal.wall : pr.fill ? pal.bg : 'none'
  const dash = pr.dash ? `${f1(opts.sw * 6)} ${f1(opts.sw * 4)}` : undefined

  switch (pr.k) {
    case 'l':
      return {
        tag: 'path',
        d: `M${f1(pr.a[0])} ${f1(pr.a[1])}L${f1(pr.b[0])} ${f1(pr.b[1])}`,
        className: pr.nostroke ? 'wall' : undefined,
        stroke: pr.nostroke ? 'none' : col,
        strokeWidth: pr.nostroke ? undefined : swRounded,
        fill,
        strokeDasharray: pr.nostroke ? undefined : dash,
      }
    case 'pl':
      return {
        tag: 'path',
        d: ptsPath(pr.pts, pr.closed),
        className: pr.nostroke ? 'wall' : undefined,
        stroke: pr.nostroke ? 'none' : col,
        strokeWidth: pr.nostroke ? undefined : swRounded,
        fill,
        strokeDasharray: pr.nostroke ? undefined : dash,
      }
    case 'ring':
      return {
        tag: 'path',
        className: 'wall',
        d: `${ptsPath(pr.outer, true)}${ptsPath(pr.inner, true)}`,
        fillRule: 'evenodd',
        fill: pal.wall,
        stroke: pr.nostroke ? 'none' : col,
        strokeWidth: pr.nostroke ? undefined : w,
      }
    case 'c':
      return {
        tag: 'circle',
        cx: f1(pr.c[0]),
        cy: f1(pr.c[1]),
        r: f1(pr.r),
        className: pr.nostroke ? 'wall' : undefined,
        stroke: pr.nostroke ? 'none' : col,
        strokeWidth: pr.nostroke ? undefined : swRounded,
        fill,
        strokeDasharray: pr.nostroke ? undefined : dash,
      }
    case 'arc': {
      const pointAt = (deg: number): Point => [
        pr.c[0] + pr.r * Math.cos(deg * RAD),
        pr.c[1] + pr.r * Math.sin(deg * RAD),
      ]
      const p0 = pointAt(pr.a0)
      const p1 = pointAt(pr.a1)
      const largeArc = pr.a1 - pr.a0 > 180 ? 1 : 0
      return {
        tag: 'path',
        d: `M${f1(p0[0])} ${f1(p0[1])}A${f1(pr.r)} ${f1(pr.r)} 0 ${largeArc} 1 ${f1(p1[0])} ${f1(p1[1])}`,
        className: pr.nostroke ? 'wall' : undefined,
        stroke: pr.nostroke ? 'none' : col,
        strokeWidth: pr.nostroke ? undefined : swRounded,
        fill,
        strokeDasharray: pr.nostroke ? undefined : dash,
      }
    }
    case 'arrow': {
      const u = rotP([1, 0], pr.dir)
      const v: Point = [-u[1], u[0]]
      const h = pr.h
      const b: Point = [pr.p[0] - (u[0] * h) / 2, pr.p[1] - (u[1] * h) / 2]
      return {
        tag: 'path',
        className: 'arw',
        d: ptsPath([
          [pr.p[0] + (u[0] * h) / 2, pr.p[1] + (u[1] * h) / 2],
          [b[0] + v[0] * h * 0.35, b[1] + v[1] * h * 0.35],
          [b[0] - v[0] * h * 0.35, b[1] - v[1] * h * 0.35],
        ], true),
        fill: col,
        stroke: 'none',
      }
    }
    case 't': {
      const x = f1(pr.p[0])
      const y = f1(pr.p[1])
      return {
        tag: 'text',
        x,
        y,
        fontSize: f1(pr.h),
        textAnchor: pr.anchor,
        fill: pr.col ? pal.pick[pr.col] : pal.lbl[layer],
        fontWeight: pr.b ? '700' : undefined,
        fontStyle: pr.it ? 'italic' : undefined,
        textDecoration: pr.ul ? 'underline' : undefined,
        transform: pr.rot ? `rotate(${f1(pr.rot)} ${x} ${y})` : undefined,
        text: pr.s,
      }
    }
  }
}

export function primSVG(pr: Prim, layer: LayerKey, opts: SvgRenderOptions): string {
  const item = primToRenderItem(pr, layer, opts)
  if (!item) return ''

  switch (item.tag) {
    case 'path': {
      if (item.className === 'hit') {
        return `<path class="hit" d="${item.d}" fill="transparent" stroke="none"/>`
      }
      if (item.className === 'arw') {
        return `<path class="arw" d="${item.d}" fill="${item.fill}" stroke="none"/>`
      }
      if (item.fillRule === 'evenodd') {
        const strokeAttr = item.stroke === 'none'
          ? 'stroke="none"'
          : `stroke="${item.stroke}" stroke-width="${item.strokeWidth}"`
        return `<path class="wall" d="${item.d}" fill-rule="evenodd" fill="${item.fill}" ${strokeAttr}/>`
      }
      const st = item.stroke === 'none'
        ? `class="wall" stroke="none" fill="${item.fill}"`
        : `stroke="${item.stroke}" stroke-width="${item.strokeWidth}" fill="${item.fill}"${item.strokeDasharray ? ` stroke-dasharray="${item.strokeDasharray}"` : ''}`
      return `<path d="${item.d}" ${st}/>`
    }
    case 'circle': {
      const st = item.stroke === 'none'
        ? `class="wall" stroke="none" fill="${item.fill}"`
        : `stroke="${item.stroke}" stroke-width="${item.strokeWidth}" fill="${item.fill}"${item.strokeDasharray ? ` stroke-dasharray="${item.strokeDasharray}"` : ''}`
      return `<circle cx="${item.cx}" cy="${item.cy}" r="${item.r}" ${st}/>`
    }
    case 'text': {
      const sty = `${item.fontWeight ? ` font-weight="${item.fontWeight}"` : ''}${item.fontStyle ? ` font-style="${item.fontStyle}"` : ''}${item.textDecoration ? ` text-decoration="${item.textDecoration}"` : ''}`
      const tr = item.transform ? ` transform="${item.transform}"` : ''
      return `<text x="${item.x}" y="${item.y}" font-size="${item.fontSize}" text-anchor="${item.textAnchor}" fill="${item.fill}"${sty}${tr}>${escXml(item.text)}</text>`
    }
  }
}

export function nodeSVG(
  node: Node,
  ctx: RenderCtx,
  opts: SvgRenderOptions,
  extraCls = '',
): Partial<Record<LayerKey, string>> {
  const base = layerOf(node)
  const parts: Partial<Record<LayerKey, string[]>> = {}
  for (const pr of worldPrims(node, ctx)) {
    const layer = pr.layer ?? base
    const list = (parts[layer] ??= [])
    list.push(primSVG(pr, layer, opts))
  }
  const out: Partial<Record<LayerKey, string>> = {}
  for (const [layer, items] of Object.entries(parts) as Array<[LayerKey, string[]]>) {
    out[layer] = `<g data-id="${node.id}"${extraCls ? ` class="${extraCls}"` : ''}>${items.join('')}</g>`
  }
  return out
}

export function projectSVG(project: Project, ctx: RenderCtx, opts: SvgRenderOptions): string {
  const buckets: Record<LayerKey, string[]> = {
    denah: [],
    arsi: [],
    kolom: [],
    bukaan: [],
    dim: [],
    hanger: [],
    eq: [],
    diff: [],
    sa: [],
    ea: [],
    coret: [],
  }
  for (const node of project.nodes) {
    const parts = nodeSVG(node, ctx, opts, opts.sel?.has(node.id) ? 'sel' : '')
    for (const [layer, markup] of Object.entries(parts) as Array<[LayerKey, string]>) {
      if (project.layers[layer] ? project.layers[layer].on : true) {
        buckets[layer].push(markup)
      }
    }
  }
  return DRAW_ORDER
    .map(k => `<g data-layer="${k}"${project.layers[k]?.lock ? ' class="lock"' : ''}>${buckets[k].join('')}</g>`)
    .join('')
}

/** Dokumen SVG mandiri untuk thumbnail, export PNG, dan export PDF. */
export function docSVG(project: Project, opt: DocSvgOptions = {}): DocSvgResult {
  const cn = connect(project)
  const ctx = ctxOf(project, cn)
  const pal: PaletteName = opt.pal ?? 'paper'

  const layers = Object.fromEntries(
    LAYERS.map(layer => [
      layer.key,
      { on: opt.layers ? opt.layers.has(layer.key) : project.layers[layer.key].on, lock: false },
    ]),
  ) as LayersMap

  const filteredProject: Project = { ...project, layers }
  const b = projectBounds(project, ctx)
  const margin = ctx.th * 3
  const noteHeight = opt.note ? ctx.th * 3 : 0
  const vb: Bounds = [
    b[0] - margin,
    b[1] - margin,
    b[2] - b[0] + 2 * margin,
    b[3] - b[1] + 2 * margin + noteHeight,
  ]
  const sw = opt.sw || vb[2] / 900
  const body = projectSVG(filteredProject, ctx, { pal, sw, live: false })
  const noteSvg = opt.note
    ? `<text x="${f1(b[0])}" y="${f1(b[3] + margin + noteHeight * 0.5)}" font-size="${f1(ctx.th * 0.9)}" fill="${PAL[pal].lbl.dim}">Sketsa bantu Temandor – cek ulang ukuran di lapangan. ${escXml(project.name)} · ${escXml(project.scale)} · duct ${project.unit}</text>`
    : ''

  return {
    vb,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(f1).join(' ')}" font-family="'JetBrains Mono', ui-monospace, monospace"><rect x="${f1(vb[0])}" y="${f1(vb[1])}" width="${f1(vb[2])}" height="${f1(vb[3])}" fill="${PAL[pal].bg}"/>${body}${noteSvg}</svg>`,
  }
}
