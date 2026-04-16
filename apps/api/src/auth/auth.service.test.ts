import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConflictException, UnauthorizedException } from '@nestjs/common'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { AuthService, type AuthConfig } from './auth.service'
import type { PrismaService } from '../prisma/prisma.service'
import type { RedisService } from '../redis/redis.service'

const config: AuthConfig = {
  jwtSecret: 'a'.repeat(20),
  jwtRefreshSecret: 'b'.repeat(20),
  accessTtl: '15m',
  refreshTtl: '7d',
}

function makeRedis(): RedisService & {
  store: Map<string, string>
  setWithTTL: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  del: ReturnType<typeof vi.fn>
} {
  const store = new Map<string, string>()
  return {
    store,
    setWithTTL: vi.fn(async (k: string, v: string) => {
      store.set(k, v)
    }),
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    del: vi.fn(async (k: string) => {
      store.delete(k)
    }),
  } as unknown as RedisService & {
    store: Map<string, string>
    setWithTTL: ReturnType<typeof vi.fn>
    get: ReturnType<typeof vi.fn>
    del: ReturnType<typeof vi.fn>
  }
}

interface UserRow {
  id: string
  tenantId: string
  email: string
  name: string
  role: string
  password: string
  isActive: boolean
}

function makePrisma(opts: { existingSubdomain?: string; users?: UserRow[] }): PrismaService {
  const users = opts.users ?? []
  const created: { tenant?: unknown; user?: UserRow } = {}
  return {
    tenant: {
      findUnique: vi.fn(async ({ where }: { where: { subdomain: string } }) =>
        where.subdomain === opts.existingSubdomain ? { id: 'existing' } : null,
      ),
    },
    user: {
      findFirst: vi.fn(
        async ({ where }: { where: { email?: string; id?: string; isActive?: boolean } }) => {
          if (where.email) return users.find((u) => u.email === where.email && u.isActive) ?? null
          if (where.id) return users.find((u) => u.id === where.id && u.isActive) ?? null
          return null
        },
      ),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        tenant: {
          create: vi.fn(async ({ data }: { data: { name: string; subdomain: string } }) => {
            const t = { id: 'tenant-new', ...data }
            created.tenant = t
            return t
          }),
        },
        user: {
          create: vi.fn(async ({ data }: { data: Omit<UserRow, 'id'> }) => {
            const u: UserRow = { id: 'user-new', ...data }
            created.user = u
            return u
          }),
        },
      }
      return fn(tx)
    }),
  } as unknown as PrismaService
}

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('registerTenant', () => {
    it('creates tenant + admin and returns tokens', async () => {
      const redis = makeRedis()
      const prisma = makePrisma({})
      const svc = new AuthService(prisma, redis, config)

      const result = await svc.registerTenant({
        tenantName: 'Clinica X',
        subdomain: 'clinica-x',
        adminEmail: 'ADMIN@X.TEST',
        adminName: 'Admin',
        adminPassword: 'password123',
      })

      expect(result.user.email).toBe('admin@x.test')
      expect(result.user.role).toBe('admin')
      expect(result.tokens.accessToken).toBeTruthy()
      expect(result.tokens.refreshToken).toBeTruthy()
      expect(redis.setWithTTL).toHaveBeenCalledOnce()
    })

    it('rejects when subdomain is taken', async () => {
      const redis = makeRedis()
      const prisma = makePrisma({ existingSubdomain: 'clinica-x' })
      const svc = new AuthService(prisma, redis, config)

      await expect(
        svc.registerTenant({
          tenantName: 'Clinica X',
          subdomain: 'clinica-x',
          adminEmail: 'admin@x.test',
          adminName: 'Admin',
          adminPassword: 'password123',
        }),
      ).rejects.toBeInstanceOf(ConflictException)
    })
  })

  describe('login', () => {
    it('returns tokens on valid credentials', async () => {
      const redis = makeRedis()
      const password = await bcrypt.hash('password123', 4)
      const prisma = makePrisma({
        users: [
          {
            id: 'u1',
            tenantId: 't1',
            email: 'a@b.c',
            name: 'A',
            role: 'admin',
            password,
            isActive: true,
          },
        ],
      })
      const svc = new AuthService(prisma, redis, config)

      const result = await svc.login({ email: 'a@b.c', password: 'password123' })
      expect(result.user.id).toBe('u1')
      expect(result.tokens.accessToken).toBeTruthy()
    })

    it('throws 401 when user not found', async () => {
      const redis = makeRedis()
      const prisma = makePrisma({ users: [] })
      const svc = new AuthService(prisma, redis, config)
      await expect(svc.login({ email: 'a@b.c', password: 'password123' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      )
    })

    it('throws 401 on wrong password', async () => {
      const redis = makeRedis()
      const password = await bcrypt.hash('password123', 4)
      const prisma = makePrisma({
        users: [
          {
            id: 'u1',
            tenantId: 't1',
            email: 'a@b.c',
            name: 'A',
            role: 'admin',
            password,
            isActive: true,
          },
        ],
      })
      const svc = new AuthService(prisma, redis, config)
      await expect(
        svc.login({ email: 'a@b.c', password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException)
    })
  })

  describe('refresh', () => {
    it('rotates tokens on valid refresh', async () => {
      const redis = makeRedis()
      const prisma = makePrisma({
        users: [
          {
            id: 'u1',
            tenantId: 't1',
            email: 'a@b.c',
            name: 'A',
            role: 'admin',
            password: 'x',
            isActive: true,
          },
        ],
      })
      const svc = new AuthService(prisma, redis, config)

      const password = await bcrypt.hash('password123', 4)
      ;(prisma.user as unknown as { findFirst: ReturnType<typeof vi.fn> }).findFirst = vi.fn(
        async () => ({
          id: 'u1',
          tenantId: 't1',
          email: 'a@b.c',
          name: 'A',
          role: 'admin',
          password,
          isActive: true,
        }),
      )

      const logged = await svc.login({ email: 'a@b.c', password: 'password123' })
      const refreshed = await svc.refresh({ refreshToken: logged.tokens.refreshToken })
      expect(refreshed.tokens.refreshToken).not.toBe(logged.tokens.refreshToken)
      expect(redis.del).toHaveBeenCalled()
    })

    it('throws 401 on malformed refresh', async () => {
      const redis = makeRedis()
      const prisma = makePrisma({ users: [] })
      const svc = new AuthService(prisma, redis, config)
      await expect(svc.refresh({ refreshToken: 'garbage' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      )
    })

    it('throws 401 when refresh has been revoked (not in redis)', async () => {
      const redis = makeRedis()
      const prisma = makePrisma({ users: [] })
      const svc = new AuthService(prisma, redis, config)
      const refreshToken = jwt.sign(
        { sub: 'u1', tenantId: 't1', jti: 'abc' },
        config.jwtRefreshSecret,
        { expiresIn: '1h' },
      )
      await expect(svc.refresh({ refreshToken })).rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('throws 401 when user has been deactivated', async () => {
      const redis = makeRedis()
      const prisma = makePrisma({ users: [] })
      const svc = new AuthService(prisma, redis, config)
      const refreshToken = jwt.sign(
        { sub: 'u1', tenantId: 't1', jti: 'abc' },
        config.jwtRefreshSecret,
        { expiresIn: '1h' },
      )
      await redis.setWithTTL(`refresh:u1:abc`, '{}', 60)
      await expect(svc.refresh({ refreshToken })).rejects.toBeInstanceOf(UnauthorizedException)
    })
  })

  describe('logout', () => {
    it('removes refresh key from redis', async () => {
      const redis = makeRedis()
      const prisma = makePrisma({ users: [] })
      const svc = new AuthService(prisma, redis, config)
      const refreshToken = jwt.sign(
        { sub: 'u1', tenantId: 't1', jti: 'abc' },
        config.jwtRefreshSecret,
        { expiresIn: '1h' },
      )
      await redis.setWithTTL(`refresh:u1:abc`, '{}', 60)
      await svc.logout(refreshToken)
      expect(redis.del).toHaveBeenCalledWith('refresh:u1:abc')
    })

    it('silently ignores invalid refresh token', async () => {
      const redis = makeRedis()
      const prisma = makePrisma({ users: [] })
      const svc = new AuthService(prisma, redis, config)
      await expect(svc.logout('garbage')).resolves.toBeUndefined()
    })
  })

  describe('verifyAccessToken', () => {
    it('returns payload on valid token', () => {
      const redis = makeRedis()
      const prisma = makePrisma({ users: [] })
      const svc = new AuthService(prisma, redis, config)
      const token = jwt.sign({ sub: 'u1', tenantId: 't1', role: 'admin' }, config.jwtSecret, {
        expiresIn: '1h',
      })
      const payload = svc.verifyAccessToken(token)
      expect(payload.sub).toBe('u1')
      expect(payload.role).toBe('admin')
    })

    it('throws UnauthorizedException on bad token', () => {
      const redis = makeRedis()
      const prisma = makePrisma({ users: [] })
      const svc = new AuthService(prisma, redis, config)
      expect(() => svc.verifyAccessToken('garbage')).toThrow(UnauthorizedException)
    })
  })
})
