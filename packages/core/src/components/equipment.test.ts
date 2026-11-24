import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import {
  ALL_LIBRARY_ITEMS,
  COMPONENTS,
  LIBRARY_GROUPS,
  connect,
  createLibraryNode,
  createNode,
  ctxOf,
  defaultDuctSpec,
  libraryItemInfo,
  newProject,
  nodeGrips,
  nodeSVG,
  nodeSchema,
  worldPorts,
  worldPrims,
  type Node,
  type NodeType,
  type Project,
  type Unit,
} from '../index'

const EQUIPMENT_TYPES = [
  'diffuser',
  'grille',
  'louver',
  'fan',
  'fcu',
  'outdoor',
] as const satisfies readonly NodeType[]

function loadPrototypeVm() {
  const ctx = vm.createContext({ structuredClone, console, Math, JSON })
  for (const file of ['geom.js', 'model.js', 'render.js']) {
    const src = readFileSync(resolve(process.cwd(), 'prototype/app/js', file), 'utf8')
    vm.runInContext(src, ctx, { filename: file })
  }
  return {
    nodeSVG(project: Project, nodeIndex: number, pal: 'screen' | 'paper' | 'light') {
      return vm.runInContext(
        `(() => { const p = ${JSON.stringify(project)}; const c = ctxOf(p, connect(p)); return JSON.stringify(nodeSVG(p.nodes[${nodeIndex}], c, { pal: ${JSON.stringify(pal)}, sw: 1.4, live: true })); })()`,
        ctx,
      ) as string
    },
  }
}

describe('perlengkapan, equipment, gantungan, dan library (M3-04)', () => {
  const proto = loadPrototypeVm()

  it('semua komponen perlengkapan & equipment lengkap dan render SVG 100% identik dengan prototype', () => {
    for (const type of EQUIPMENT_TYPES) {
      const def = COMPONENTS[type]
      expect(def.name.length).toBeGreaterThan(0)
      expect(def.icon).toBeTruthy()
      expect(typeof def.prims).toBe('function')
      expect(typeof def.grips).toBe('function')

      const sample = createNode(type)
      expect(nodeGrips(sample, 'inch').length).toBeGreaterThanOrEqual(1)
      if (type !== 'outdoor') {
        expect(worldPorts(sample, 'inch').length).toBeGreaterThanOrEqual(1)
      }
    }

    // Uji paritas SVG seluruh perlengkapan/equipment + gantungan otomatis pada duct lurus
    const samples: Node[] = [
      createNode('diffuser', { x: 100, y: 200, flow: 450, rot: 0 }),
      createNode('grille', { x: 100, y: 200, flow: 200, rot: 90 }),
      createNode('louver', { x: 100, y: 200, rot: 180 }),
      createNode('fan', { x: 100, y: 200, rot: 0, tag: 'EF-02' }),
      createNode('fcu', { x: 100, y: 200, rot: 0, tag: 'FCU-02' }),
      createNode('outdoor', { x: 100, y: 200, rot: 90, tag: 'ODU-02' }),
      createNode('straight', { x: 0, y: 0, L: 4500 }), // memicu 2 gantungan otomatis pada sp=1500
    ]

    for (const pal of ['screen', 'paper', 'light'] as const) {
      for (const node of samples) {
        const p = newProject({ unit: 'inch', scale: '1:100' })
        p.nodes = [node]
        const ctx = ctxOf(p, connect(p))
        const ours = JSON.stringify(nodeSVG(node, ctx, { pal, sw: 1.4, live: true }))
        const theirs = proto.nodeSVG(p, 0, pal)
        expect(ours).toBe(theirs)
      }
    }

    // Verifikasi gantungan otomatis aktif pada layer `hanger`
    const hp = newProject({ unit: 'inch' })
    const s = createNode('straight', { L: 4500 })
    hp.nodes = [s]
    const hSvg = nodeSVG(s, ctxOf(hp, connect(hp)), { pal: 'screen', sw: 1.4, live: true })
    expect(hSvg.hanger).toBeTruthy()
  })

  it('seluruh 6 kelompok library (29 item) memiliki ikon SVG valid di app/assets/svg dan menghasilkan node valid', () => {
    expect(LIBRARY_GROUPS.map(g => g.name)).toEqual([
      'Ruangan',
      'Arsitektur',
      'Equipment',
      'Duct',
      'Fitting',
      'Perlengkapan',
    ])
    expect(ALL_LIBRARY_ITEMS).toHaveLength(29)

    for (const unit of ['inch', 'mm'] as Unit[]) {
      const p = newProject({ unit })
      const spec = defaultDuctSpec(unit)

      for (const id of ALL_LIBRARY_ITEMS) {
        const info = libraryItemInfo(id)
        expect(info.name.length).toBeGreaterThan(0)
        const svgPath = resolve(process.cwd(), 'app/assets/svg', `${info.icon}.svg`)
        expect(existsSync(svgPath), `Ikon hilang: ${svgPath}`).toBe(true)

        const node = createLibraryNode(id, { project: p, ductSpec: spec, position: [1200, 800] })
        expect(() => nodeSchema.parse(node)).not.toThrow()
        const ctx = ctxOf(p, connect(p))
        expect(worldPrims(node, ctx).length).toBeGreaterThan(0)
      }
    }
  })
})
