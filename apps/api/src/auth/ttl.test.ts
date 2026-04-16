import { describe, it, expect } from 'vitest'
import { ttlToSeconds } from './ttl'

describe('ttlToSeconds', () => {
  it('converts seconds', () => {
    expect(ttlToSeconds('45s')).toBe(45)
  })
  it('converts minutes', () => {
    expect(ttlToSeconds('15m')).toBe(15 * 60)
  })
  it('converts hours', () => {
    expect(ttlToSeconds('2h')).toBe(2 * 60 * 60)
  })
  it('converts days', () => {
    expect(ttlToSeconds('7d')).toBe(7 * 60 * 60 * 24)
  })
  it('throws on malformed value', () => {
    expect(() => ttlToSeconds('later')).toThrow(/Invalid TTL/)
  })
})
