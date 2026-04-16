import { BadRequestException, Injectable, type NestMiddleware } from '@nestjs/common'
import type { Request, Response, NextFunction } from 'express'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type TenantRequest = Request & { tenantIdHeader?: string }

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const raw = req.header('x-tenant-id')
    if (raw) {
      if (!UUID_RE.test(raw)) {
        throw new BadRequestException('X-Tenant-ID must be a valid UUID')
      }
      ;(req as TenantRequest).tenantIdHeader = raw.toLowerCase()
    }
    next()
  }
}
