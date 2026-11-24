import { describe, expect, it } from 'vitest'

describe('core CAD', () => {
  it('berjalan di Node tanpa DOM', () => {
    expect(typeof window).toBe('undefined')
  })
})
