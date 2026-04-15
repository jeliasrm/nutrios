import { describe, it, expect } from 'vitest'
import { UI_VERSION } from './index'

describe('@nutrios/ui — package metadata', () => {
  it('exposes a version constant for traceability', () => {
    expect(UI_VERSION).toBe('0.1.0')
  })
})
