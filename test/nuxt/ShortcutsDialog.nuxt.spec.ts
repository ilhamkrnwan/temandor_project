import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { CadShortcutsDialog } from '#components'
import { COMMAND_REFERENCE, SHORTCUTS } from '../../shared/cad'

describe('CadShortcutsDialog.vue', () => {
  it('menampilkan seluruh entri dari tabel sumber tunggal SHORTCUTS dan COMMAND_REFERENCE', async () => {
    const wrapper = await mountSuspended(CadShortcutsDialog, {
      props: { open: true },
      global: {
        stubs: {
          UModal: {
            props: ['open', 'title', 'description'],
            template: '<div role="dialog"><h2>{{ title }}</h2><slot name="body" /></div>',
          },
        },
      },
    })

    const renderedIds = new Set(
      wrapper.findAll('[data-shortcut-id]').map(el => el.attributes('data-shortcut-id')),
    )
    expect(renderedIds.size).toBe(SHORTCUTS.length)
    for (const def of SHORTCUTS) {
      expect(renderedIds.has(def.id)).toBe(true)
      expect(wrapper.text()).toContain(def.label)
    }

    const renderedCommands = new Set(
      wrapper.findAll('[data-command-ref]').map(el => el.attributes('data-command-ref')),
    )
    for (const ref of COMMAND_REFERENCE) {
      expect(renderedCommands.has(ref.cmd)).toBe(true)
    }
  })
})
