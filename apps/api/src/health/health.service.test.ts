import { describe, it, expect } from 'vitest'
import { HealthService } from './health.service'

describe('HealthService', () => {
  it('returns ok status payload', () => {
    const svc = new HealthService()
    const result = svc.check()
    expect(result.status).toBe('ok')
    expect(result.service).toBe('nutrios-api')
    expect(result.version).toBe('0.1.0')
  })

  it('includes a valid ISO timestamp', () => {
    const svc = new HealthService()
    const result = svc.check()
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow()
  })

  it('reports non-negative uptime_s', () => {
    const svc = new HealthService()
    const result = svc.check()
    expect(result.uptime_s).toBeGreaterThanOrEqual(0)
  })
})
