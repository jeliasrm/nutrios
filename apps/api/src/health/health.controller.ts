import { Controller, Get } from '@nestjs/common'
import type { HealthService } from './health.service'
import { Public } from '../auth/decorators'

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  check() {
    return this.healthService.check()
  }
}
