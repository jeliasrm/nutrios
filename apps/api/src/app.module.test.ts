import { describe, it, expect } from 'vitest'
import { Test } from '@nestjs/testing'
import { AppModule } from './app.module'
import { HealthController } from './health/health.controller'

describe('AppModule', () => {
  it('boots with HealthModule wired in', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    const controller = moduleRef.get(HealthController)
    expect(controller).toBeDefined()
  })
})
