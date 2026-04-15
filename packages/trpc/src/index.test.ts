import { describe, it, expect } from 'vitest'
import { TRPC_VERSION } from './index'

describe('@nutrios/trpc — package metadata', () => {
  it('declares the tRPC major version pinned for Phase 2', () => {
    expect(TRPC_VERSION).toBe('11')
  })
})
