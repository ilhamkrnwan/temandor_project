import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'
import {
  LAYER_KEYS,
  LAYERS,
  NODE_DEFAULTS,
  createNode,
  demoProject,
  newProject,
  nodeSchema,
  parseProject,
  safeParseProject,
  type NodeType,
  type Project,
  type projectSchema,
} from './index'

describe('tipe & skema proyek v2 (M2-01)', () => {
  it('berjalan murni di Node tanpa DOM', () => {
    expect(typeof window).toBe('undefined')
  })

  it('tipe inferensi Zod selaras dengan interface Project', () => {
    type SchemaProject = z.infer<typeof projectSchema>
    expectTypeOf<SchemaProject>().toEqualTypeOf<Project>()
  })

  it('newProject() membuat proyek v2 valid dengan satuan nyata tanpa konversi', () => {
    const project = newProject({ name: 'Ruko 2 Lantai', unit: 'mm', scale: '1:50', W: 8000, H: 5000 })
    const parsed = parseProject(project)

    expect(parsed.version).toBe(2)
    expect(parsed.name).toBe('Ruko 2 Lantai')
    expect(parsed.unit).toBe('mm')
    expect(parsed.scale).toBe('1:50')
    expect(parsed.fu).toBe('cfm')
    expect(parsed.hang).toEqual({ on: true, sp: 1500 })
    expect(Object.keys(parsed.layers)).toEqual(LAYER_KEYS)
    expect(LAYERS).toHaveLength(11)
    expect(parsed.nodes).toHaveLength(1)
    expect(parsed.nodes[0]).toMatchObject({
      type: 'room',
      W: 8000,
      H: 5000,
      t: 150,
      name: 'Ruangan 1',
      dims: true,
    })
  })

  it('createNode() menghasilkan node valid untuk semua 30 tipe dan tidak membagi referensi mutabel', () => {
    const types = Object.keys(NODE_DEFAULTS) as NodeType[]
    expect(types).toHaveLength(30)

    for (const type of types) {
      const node = createNode(type)
      const result = nodeSchema.safeParse(node)
      expect(result.success, `tipe ${type}`).toBe(true)
    }

    const s1 = createNode('sketch')
    const s2 = createNode('sketch')
    s1.pts[0]![0] = 999
    expect(s2.pts[0]![0]).toBe(0)
  })

  it('demoProject() lolos skema Zod v2 dan cocok dengan geometri prototype', () => {
    const demo = demoProject()
    const parsed = parseProject(demo)

    expect(parsed.version).toBe(2)
    expect(parsed.unit).toBe('inch')
    expect(parsed.scale).toBe('1:100')
    expect(parsed.nodes).toHaveLength(32)

    // Bandingkan geometri demoProject() v2 dengan prototype/app/js/model.js
    const ctx = vm.createContext({ structuredClone, Math, JSON })
    for (const file of ['geom.js', 'model.js']) {
      const src = readFileSync(resolve(process.cwd(), 'prototype/app/js', file), 'utf8')
      vm.runInContext(src, ctx, { filename: file })
    }
    const protoDemo = vm.runInContext('demoProject()', ctx) as {
      nodes: Array<Record<string, unknown>>
    }

    expect(parsed.nodes.length).toBe(protoDemo.nodes.length)
    for (let i = 0; i < parsed.nodes.length; i++) {
      const a = parsed.nodes[i]!
      const b = protoDemo.nodes[i]!
      expect(a.type, `node[${i}].type`).toBe(b.type)
      expect(a.x, `node[${i}].x`).toBeCloseTo(Number(b.x), 6)
      expect(a.y, `node[${i}].y`).toBeCloseTo(Number(b.y), 6)
      expect(a.rot, `node[${i}].rot`).toBeCloseTo(Number(b.rot), 6)
      expect(a.mir, `node[${i}].mir`).toBe(Boolean(b.mir))
    }
  })

  it('menolak file proyek dengan versi, satuan, skala, atau node tidak valid', () => {
    const base = newProject()

    expect(safeParseProject({ ...base, version: 1 }).success).toBe(false)
    expect(safeParseProject({ ...base, unit: 'cm' }).success).toBe(false)
    expect(safeParseProject({ ...base, scale: '100' }).success).toBe(false)
    expect(safeParseProject({
      ...base,
      nodes: [{ id: 'x', type: 'naga', x: 0, y: 0, rot: 0, mir: false }],
    }).success).toBe(false)
    expect(safeParseProject({
      ...base,
      nodes: [createNode('straight', { w: 0 })],
    }).success).toBe(false)
    expect(safeParseProject({
      ...base,
      nodes: [createNode('straight', { x: Number.NaN })],
    }).success).toBe(false)
    expect(safeParseProject({
      ...base,
      nodes: [createNode('room', { pts: [[0, 0], [1000, 0]] })],
    }).success).toBe(false)
  })
})
