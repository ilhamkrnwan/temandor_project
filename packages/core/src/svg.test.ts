import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import {
  DRAW_ORDER,
  PAL,
  connect,
  createNode,
  ctxOf,
  demoProject,
  docSVG,
  escXml,
  newProject,
  projectSVG,
  type Project,
} from './index'

function deterministicDemo(): Project {
  const demo = demoProject()
  demo.id = 'demo-fixed'
  demo.updated = 0
  demo.nodes.forEach((node, index) => {
    node.id = `n${index + 1}`
  })
  return demo
}

function normalizeIds(svg: string): string {
  return svg.replace(/data-id="[^"]+"/g, 'data-id="ID"')
}

function renderProtoDocSvg(pal: 'screen' | 'paper' | 'light', note: boolean) {
  const ctx = vm.createContext({ structuredClone, Math, JSON })
  for (const file of ['geom.js', 'model.js', 'dxf.js', 'render.js']) {
    const src = readFileSync(resolve(process.cwd(), 'prototype/app/js', file), 'utf8')
    vm.runInContext(src, ctx, { filename: file })
  }
  return JSON.parse(
    vm.runInContext(`JSON.stringify(docSVG(demoProject(), { pal: '${pal}', note: ${note} }))`, ctx),
  ) as { vb: number[], svg: string }
}

describe('render SVG murni (svg.ts)', () => {
  it('snapshot docSVG(demoProject()) stabil untuk palet screen dan paper', () => {
    const demo = deterministicDemo()
    const screenDoc = docSVG(demo, { pal: 'screen', note: true })
    const paperDoc = docSVG(demo, { pal: 'paper', note: true })

    expect(screenDoc.svg).toMatchSnapshot('demo-screen')
    expect(paperDoc.svg).toMatchSnapshot('demo-paper')
  })

  it('hasil docSVG(demoProject()) identik dengan prototype untuk screen, paper, dan light', () => {
    const demo = deterministicDemo()

    for (const pal of ['screen', 'paper', 'light'] as const) {
      const ours = docSVG(demo, { pal, note: true })
      const proto = renderProtoDocSvg(pal, true)

      expect(ours.vb).toHaveLength(4)
      for (let i = 0; i < 4; i++) {
        expect(ours.vb[i], `${pal} vb[${i}]`).toBeCloseTo(proto.vb[i]!, 4)
      }
      expect(normalizeIds(ours.svg), `SVG parity (${pal})`).toBe(normalizeIds(proto.svg))
    }
  })

  it('menghormati urutan DRAW_ORDER, status layer on/lock, seleksi, dan proyek kosong', () => {
    const project = newProject({ name: 'Uji <Layer> & "Quote"', unit: 'mm', scale: '1:100' })
    const duct = createNode('straight', { id: 'd1', x: 500, y: 500, L: 1500 })
    project.nodes.push(duct)
    project.layers.sa.lock = true
    project.layers.hanger.on = false

    const cn = connect(project)
    const ctx = ctxOf(project, cn)
    const body = projectSVG(project, ctx, { pal: 'screen', sw: 1.4, live: true, sel: new Set(['d1']) })

    const layerOrder = [...body.matchAll(/data-layer="([^"]+)"/g)].map(m => m[1])
    expect(layerOrder).toEqual([...DRAW_ORDER])
    expect(body).toContain('<g data-layer="sa" class="lock">')
    expect(body).toContain('<g data-id="d1" class="sel">')
    expect(body).toContain('<g data-layer="hanger"></g>')

    const doc = docSVG(project, { pal: 'paper', note: true })
    expect(doc.svg).toContain('Uji &lt;Layer&gt; &amp; &quot;Quote&quot;')
    expect(escXml('a&b<c>"d"')).toBe('a&amp;b&lt;c&gt;&quot;d&quot;')

    // Proyek kosong tetap menghasilkan viewBox wajar
    const empty = newProject()
    empty.nodes = []
    const emptyDoc = docSVG(empty, { pal: 'light' })
    expect(emptyDoc.svg).toContain(`fill="${PAL.light.bg}"`)
    expect(emptyDoc.vb[2]).toBeGreaterThan(6000)
  })
})
