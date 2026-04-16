import type { Request } from 'express'
import type { Context, AuthUser as TrpcAuthUser } from '@nutrios/trpc'
import { AuthService } from '../auth/auth.service'
import type { PrismaService } from '../prisma/prisma.service'
import type { RedisService } from '../redis/redis.service'

export interface TrpcContextServices {
  prisma: PrismaService
  redis: RedisService
  auth: AuthService
}

/**
 * Builds a tRPC context for each HTTP request. Resolves the authenticated user
 * from the Bearer token (if present) and the tenant from the JWT claim — which
 * is the only source the API trusts. The X-Tenant-ID header is validated by
 * `TenantMiddleware` but never used for authorization.
 */
export function buildTrpcContext(
  { prisma, redis, auth }: TrpcContextServices,
  req: Request,
): Context {
  const authHeader = req.header('authorization') ?? ''
  let user: TrpcAuthUser | null = null
  let tenantId: string | null = null

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length)
    try {
      const payload = auth.verifyAccessToken(token)
      user = {
        id: payload.sub,
        tenantId: payload.tenantId,
        email: '',
        name: '',
        role: payload.role as TrpcAuthUser['role'],
      }
      tenantId = payload.tenantId
    } catch {
      // invalid token → stay anonymous; protected procedures will reject
    }
  }

  return {
    prisma: { withTenant: prisma.withTenant.bind(prisma) },
    redis: {
      setWithTTL: redis.setWithTTL.bind(redis),
      get: redis.get.bind(redis),
      del: redis.del.bind(redis),
    },
    user,
    tenantId,
  }
}
