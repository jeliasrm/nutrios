import type { PrismaClient } from '@nutrios/db'
import type { UserRole } from '@nutrios/types'

export interface AuthUser {
  id: string
  tenantId: string
  email: string
  name: string
  role: UserRole
}

/**
 * The Prisma transaction client handed to routers — full Prisma API minus
 * connection-management methods (transactions are run for us by `withTenant`).
 */
export type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

export interface RedisLike {
  setWithTTL(key: string, value: string, ttlSeconds: number): Promise<void>
  get(key: string): Promise<string | null>
  del(key: string): Promise<void>
}

export interface PrismaLike {
  /**
   * Runs `fn` inside a transaction pinned to `tenantId` via RLS
   * (`SELECT set_tenant(...)`). Every read/write inside is isolated.
   */
  withTenant<T>(tenantId: string, fn: (tx: TxClient) => Promise<T>): Promise<T>
}

export interface Context {
  prisma: PrismaLike
  redis: RedisLike
  user: AuthUser | null
  tenantId: string | null
}
