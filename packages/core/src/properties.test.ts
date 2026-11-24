import { describe, expect, it } from 'vitest'
import {
  applyDuctSpecProperty,
  applyPropertyToNodes,
  connect,
  createNode,
  ctxOf,
  defaultDuctSpec,
  formatPropNumber,
  newProject,
  nodePortSummaries,
  nodeSVG,
  parseDecimalInput,
  visibleFieldsForNode,
  worldPorts,
} from './index'

describe('panel properti: parse koma desimal, pembaruan parameter, render & port ikut berubah (M3-10)', () => {
  it('parseDecimalInput menerima koma dan titik desimal serta menolak input tidak valid', () => {
    expect(parseDecimalInput('22,5')).toBe(22.5)
    expect(parseDecimalInput('22.5')).toBe(22.5)
    expect(parseDecimalInput(' 18,75 ')).toBe(18.75)
    expect(parseDecimalInput('-90')).toBe(-90)
    expect(parseDecimalInput('0')).toBe(0)
    expect(parseDecimalInput('')).toBeNull()
    expect(parseDecimalInput('12,3,4')).toBeNull()
    expect(parseDecimalInput('abc')).toBeNull()

    expect(formatPropNumber(22.5)).toBe('22,5')
    expect(formatPropNumber(24)).toBe('24')
    expect(formatPropNumber(-0)).toBe('0')
  })

  it('mengubah lebar dan panjang duct lurus memperbarui port dunia dan SVG secara langsung', () => {
    const p = newProject({ unit: 'inch' })
    const duct = createNode('straight', { x: 1000, y: 1000, L: 1500, w: 24, h: 20, shape: 'rect', sys: 'SA' })
    p.nodes.push(duct)

    const svgBefore = nodeSVG(duct, ctxOf(p, connect(p)), { pal: 'screen', sw: 1.4, live: true }).sa!
    expect(svgBefore).toContain('24&quot;x20&quot;')
    expect(worldPorts(duct, 'inch')[0]!.w).toBe(24)

    // Ubah lebar dengan koma desimal (18,5") dan panjang 2400 mm
    const resW = applyPropertyToNodes(p, new Set([duct.id]), 'w', '18,5')
    expect(resW.changed).toBe(true)
    expect(duct.w).toBe(18.5)
    expect(worldPorts(duct, 'inch')[0]!.w).toBe(18.5)
    expect(worldPorts(duct, 'inch')[1]!.w).toBe(18.5)

    const resL = applyPropertyToNodes(p, new Set([duct.id]), 'L', '2400')
    expect(resL.changed).toBe(true)
    expect(worldPorts(duct, 'inch')[1]!.pos).toEqual([3400, 1000])

    const svgAfter = nodeSVG(duct, ctxOf(p, connect(p)), { pal: 'screen', sw: 1.4, live: true }).sa!
    expect(svgAfter).toContain('18.5&quot;x20&quot;')
    expect(svgAfter).not.toBe(svgBefore)

    // Nilai <= 0 ditolak pada field positif
    const bad = applyPropertyToNodes(p, new Set([duct.id]), 'w', '0')
    expect(bad.changed).toBe(false)
    expect(bad.error).toContain('lebih dari 0')
    expect(duct.w).toBe(18.5)
  })

  it('opsi elbow: sudut 22,5° + clamp 5-150°, reducing w2/h2 & reset ke ARC, serta field rr disembunyikan saat siku', () => {
    const p = newProject({ unit: 'inch' })
    const elbow = createNode('elbow', { w: 24, h: 20, angle: 90, et: 'r', rr: '1' })
    p.nodes.push(elbow)

    expect(visibleFieldsForNode(elbow)).toContain('rr')

    // Ubah sudut dengan koma desimal "22,5"
    const resAng = applyPropertyToNodes(p, new Set([elbow.id]), 'angle', '22,5')
    expect(resAng.changed).toBe(true)
    expect(resAng.warning).toBeUndefined()
    expect(elbow.angle).toBe(22.5)
    expect(Math.round(worldPorts(elbow, 'inch')[1]!.wdir * 10) / 10).toBe(22.5)

    // Sudut di luar rentang di-clamp dengan pesan warning
    const resClamp = applyPropertyToNodes(p, new Set([elbow.id]), 'angle', '200')
    expect(resClamp.changed).toBe(true)
    expect(resClamp.warning).toContain('5-150')
    expect(elbow.angle).toBe(150)

    // Reducing: ubah w2 menjadi 18 -> w2=18, h2=20 (diambil dari h)
    applyPropertyToNodes(p, new Set([elbow.id]), 'w2', '18')
    expect(elbow.w2).toBe(18)
    expect(elbow.h2).toBe(20)
    expect(worldPorts(elbow, 'inch')[1]!.w).toBe(18)

    // Kembalikan w2 = w dan h2 = h -> otomatis kembali non-reducing (null)
    applyPropertyToNodes(p, new Set([elbow.id]), 'w2', '24')
    expect(elbow.w2).toBeNull()
    expect(elbow.h2).toBeNull()

    // Ganti ke elbow siku + vane -> field rr tidak lagi ditampilkan
    applyPropertyToNodes(p, new Set([elbow.id]), 'et', 'sq')
    expect(visibleFieldsForNode(elbow)).not.toContain('rr')
  })

  it('mengubah W/H ruangan memakai resizeRoom, multi-select sistem SA/EA melewati komponen terkunci, dan ringkasan port akurat', () => {
    const p = newProject({ unit: 'mm' })
    const room = p.nodes[0]!
    applyPropertyToNodes(p, new Set([room.id]), 'W', '8000')
    expect(room.type === 'room' && room.W).toBe(8000)

    const d1 = createNode('straight', { x: 0, y: 0, L: 1000, w: 400, h: 300, sys: 'SA' })
    const d2 = createNode('straight', { x: 1000, y: 0, L: 1000, w: 400, h: 300, sys: 'SA', lock: true })
    p.nodes.push(d1, d2)

    const resSys = applyPropertyToNodes(p, new Set([d1.id, d2.id]), 'sys', 'EA')
    expect(resSys.changed).toBe(true)
    expect(d1.sys).toBe('EA')
    expect(d2.sys).toBe('SA') // terkunci tidak ikut berubah

    const cn = connect(p)
    const summaries = nodePortSummaries(d1, p, cn)
    expect(summaries).toHaveLength(2)
    expect(summaries[0]!.connected).toBe(false)
    expect(summaries[1]!.connected).toBe(true)
    expect(summaries[1]!.statusText).toBe('ke Duct lurus')
    expect(summaries[1]!.sizeText).toBe('400x300')

    // Validasi DuctSpec menerima koma desimal dan menolak <= 0
    const spec0 = defaultDuctSpec('inch')
    const specOk = applyDuctSpecProperty(spec0, 'w', '16,5')
    expect(specOk.error).toBeUndefined()
    expect(specOk.next.w).toBe(16.5)
    expect(applyDuctSpecProperty(spec0, 'h', '-4').error).toContain('lebih dari 0')
  })
})
