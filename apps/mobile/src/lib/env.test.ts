import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getApiBaseUrl, formatGreeting } from './env'

describe('mobile env helpers', () => {
  const original = { ...process.env }

  beforeEach(() => {
    delete process.env['EXPO_PUBLIC_API_URL']
  })

  afterEach(() => {
    process.env = { ...original }
  })

  it('getApiBaseUrl defaults to localhost:3001', () => {
    expect(getApiBaseUrl()).toBe('http://localhost:3001')
  })

  it('getApiBaseUrl uses EXPO_PUBLIC_API_URL', () => {
    process.env['EXPO_PUBLIC_API_URL'] = 'https://api.nutrios.mx'
    expect(getApiBaseUrl()).toBe('https://api.nutrios.mx')
  })

  it('formatGreeting returns Buenos días before noon', () => {
    expect(formatGreeting(8)).toBe('Buenos días')
  })

  it('formatGreeting returns Buenas tardes in the afternoon', () => {
    expect(formatGreeting(14)).toBe('Buenas tardes')
  })

  it('formatGreeting returns Buenas noches after 19h', () => {
    expect(formatGreeting(21)).toBe('Buenas noches')
  })
})
