import { describe, it, expect } from 'vitest'
import { HealthController } from './health.controller'
import { HealthService } from './health.service'

describe('HealthController', () => {
  it('delegates to HealthService.check()', () => {
    const controller = new HealthController(new HealthService())
    const result = controller.check()
    expect(result.status).toBe('ok')
    expect(result.service).toBe('nutrios-api')
  })
})
