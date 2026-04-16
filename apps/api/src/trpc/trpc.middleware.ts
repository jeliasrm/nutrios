import { Injectable, type NestMiddleware } from '@nestjs/common'
import type { Request, Response, NextFunction } from 'express'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { appRouter } from '@nutrios/trpc'
import { AuthService } from '../auth/auth.service'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import { buildTrpcContext } from './trpc.context'

@Injectable()
export class TrpcMiddleware implements NestMiddleware {
  private readonly handler: ReturnType<typeof createExpressMiddleware>

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly auth: AuthService,
  ) {
    this.handler = createExpressMiddleware({
      router: appRouter,
      createContext: ({ req }) =>
        buildTrpcContext({ prisma: this.prisma, redis: this.redis, auth: this.auth }, req),
    })
  }

  use(req: Request, res: Response, next: NextFunction): void {
    this.handler(req, res, next)
  }
}
