import { Injectable } from '@nestjs/common'

export interface HealthStatus {
  status: 'ok'
  service: string
  version: string
  uptime_s: number
  timestamp: string
}

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now()

  check(): HealthStatus {
    return {
      status: 'ok',
      service: 'nutrios-api',
      version: '0.1.0',
      uptime_s: Math.round((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
    }
  }
}
