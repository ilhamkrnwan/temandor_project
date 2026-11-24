import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { CadCanvas } from '#components'
import { DRAW_ORDER, demoProject } from '../../shared/cad'

describe('CadCanvas.vue', () => {
  it('merender semua layer sesuai DRAW_ORDER dan 32 node demoProject()', async () => {
    const project = demoProject()
    const wrapper = await mountSuspended(CadCanvas, {
      props: { project, theme: 'dark' },
    })

    const layers = wrapper.findAll('#world > g[data-layer]').map(el => el.attributes('data-layer'))
    expect(layers).toEqual([...DRAW_ORDER])

    const renderedIds = new Set(wrapper.findAll('#world [data-id]').map(el => el.attributes('data-id')))
    expect(renderedIds.size).toBe(project.nodes.length)
    expect(wrapper.text()).toContain('FCU-01 · 1300 cfm')
    expect(wrapper.text()).toContain('EF-01 · 150 cfm')
    expect(wrapper.text()).toContain('KANTOR')
    expect(wrapper.find('[data-testid="cad-canvas"]').classes()).toContain('bg-cad-ground')
  })

  it('beralih ke tema kanvas terang saat prop theme="light"', async () => {
    const wrapper = await mountSuspended(CadCanvas, {
      props: { project: demoProject(), theme: 'light' },
    })

    const stage = wrapper.find('[data-testid="cad-canvas"]')
    expect(stage.classes()).toContain('cad-light')
    expect(stage.classes()).toContain('bg-canvas-light')
    expect(wrapper.html()).toContain('#1d4ed8')
  })

  it('merender penanda snap (port/end kotak, mid segitiga) dan info panjang & sudut di kursor', async () => {
    const wrapper = await mountSuspended(CadCanvas, {
      props: {
        project: demoProject(),
        cursorInside: true,
        cursorWorld: [2000, 1500],
        showSnapMarker: true,
        snap: { p: [2000, 1500], kind: 'mid' },
        cursorMeasureLabel: '1200 mm  0°',
      },
    })

    const marker = wrapper.find('[data-testid="snap-marker"]')
    expect(marker.exists()).toBe(true)
    expect(marker.attributes('data-snap-kind')).toBe('mid')
    expect(marker.find('path').exists()).toBe(true)

    const measure = wrapper.find('[data-testid="cursor-measure"]')
    expect(measure.exists()).toBe(true)
    expect(measure.text()).toBe('1200 mm  0°')

    await wrapper.setProps({ snap: { p: [1000, 1000], kind: 'port' } })
    expect(wrapper.find('[data-testid="snap-marker"]').attributes('data-snap-kind')).toBe('port')
    expect(wrapper.find('[data-testid="snap-marker"] rect').exists()).toBe(true)
  })
})
