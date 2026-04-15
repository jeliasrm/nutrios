import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getApiUrl, getPlatformDomain } from './env'

describe('env helpers', () => {
  const original = { ...process.env }

  beforeEach(() => {
    delete process.env['NEXT_PUBLIC_API_URL']
    delete process.env['NEXT_PUBLIC_PLATFORM_DOMAIN']
  })

  afterEach(() => {
    process.env = { ...original }
  })

  it('getApiUrl defaults to localhost:3001', () => {
    expect(getApiUrl()).toBe('http://localhost:3001')
  })

  it('getApiUrl uses NEXT_PUBLIC_API_URL when set', () => {
    process.env['NEXT_PUBLIC_API_URL'] = 'https://api.nutrios.mx'
    expect(getApiUrl()).toBe('https://api.nutrios.mx')
  })

  it('getPlatformDomain defaults to nutrios.mx', () => {
    expect(getPlatformDomain()).toBe('nutrios.mx')
  })

  it('getPlatformDomain respects override', () => {
    process.env['NEXT_PUBLIC_PLATFORM_DOMAIN'] = 'staging.nutrios.mx'
    expect(getPlatformDomain()).toBe('staging.nutrios.mx')
  })
})
