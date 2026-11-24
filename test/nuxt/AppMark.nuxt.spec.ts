import { mountSuspended } from '@nuxt/test-utils/runtime'
import { expect, it } from 'vitest'
import { AppMark } from '#components'

it('merender nama aplikasi', async () => {
  const wrapper = await mountSuspended(AppMark)

  expect(wrapper.text()).toBe('Temandor')
})
