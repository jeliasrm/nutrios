import { vi } from 'vitest'
import type { AuthUser, Context, PrismaLike, RedisLike, TxClient } from './context'

export interface InMemoryRedis extends RedisLike {
  store: Map<string, string>
}

export function createInMemoryRedis(): InMemoryRedis {
  const store = new Map<string, string>()
  return {
    store,
    async get(key) {
      return store.get(key) ?? null
    },
    async setWithTTL(key, value) {
      store.set(key, value)
    },
    async del(key) {
      store.delete(key)
    },
  }
}

export function createFakePrisma(tx: unknown): PrismaLike {
  return {
    withTenant: async (_tenantId, fn) => fn(tx as TxClient),
  }
}

export interface FakeCtxOptions {
  tx?: unknown
  redis?: RedisLike
  user?: AuthUser | null
  tenantId?: string | null
}

export function createFakeContext(opts: FakeCtxOptions = {}): Context {
  const tx = opts.tx ?? {}
  return {
    prisma: createFakePrisma(tx),
    redis: opts.redis ?? createInMemoryRedis(),
    user: opts.user === undefined ? defaultUser() : opts.user,
    tenantId: opts.tenantId === undefined ? 'tenant-a' : opts.tenantId,
  }
}

export function defaultUser(role: AuthUser['role'] = 'nutriologo'): AuthUser {
  return {
    id: 'user-1',
    tenantId: 'tenant-a',
    email: 'nutri@example.com',
    name: 'Dra. Test',
    role,
  }
}

export function mockFn() {
  return vi.fn()
}
