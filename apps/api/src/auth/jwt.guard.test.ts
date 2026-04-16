import { describe, it, expect, vi } from 'vitest'
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtAuthGuard } from './jwt.guard'
import type { AuthService } from './auth.service'
import type { PrismaService } from '../prisma/prisma.service'

function build(opts: {
  isPublic?: boolean
  authorization?: string
  verifyThrows?: boolean
  payload?: { sub: string; tenantId: string; role: string }
  prismaUser?: unknown
}): { guard: JwtAuthGuard; context: ExecutionContext; request: Record<string, unknown> } {
  const reflector = {
    getAllAndOverride: () => opts.isPublic ?? false,
  } as unknown as Reflector

  const auth = {
    verifyAccessToken: vi.fn(() => {
      if (opts.verifyThrows) throw new UnauthorizedException('bad')
      return opts.payload ?? { sub: 'u1', tenantId: 't1', role: 'admin' }
    }),
  } as unknown as AuthService

  const prisma = {
    user: { findFirst: vi.fn().mockResolvedValue(opts.prismaUser ?? null) },
  } as unknown as PrismaService

  const guard = new JwtAuthGuard(reflector, auth, prisma)

  const request: Record<string, unknown> = {
    headers: opts.authorization ? { authorization: opts.authorization } : {},
  }
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext

  return { guard, context, request }
}

describe('JwtAuthGuard', () => {
  it('returns true for @Public routes without checking token', async () => {
    const { guard, context } = build({ isPublic: true })
    expect(await guard.canActivate(context)).toBe(true)
  })

  it('throws 401 when Authorization header missing', async () => {
    const { guard, context } = build({})
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('throws 401 when Authorization header is not Bearer', async () => {
    const { guard, context } = build({ authorization: 'Basic x' })
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('throws 401 when token verification fails', async () => {
    const { guard, context } = build({ authorization: 'Bearer bad', verifyThrows: true })
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('throws 401 when user not in DB', async () => {
    const { guard, context } = build({ authorization: 'Bearer ok', prismaUser: null })
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('populates req.user on success', async () => {
    const prismaUser = {
      id: 'u1',
      tenantId: 't1',
      email: 'a@b.c',
      name: 'Alice',
      role: 'admin',
    }
    const { guard, context, request } = build({ authorization: 'Bearer ok', prismaUser })
    expect(await guard.canActivate(context)).toBe(true)
    expect(request.user).toEqual({
      id: 'u1',
      tenantId: 't1',
      email: 'a@b.c',
      name: 'Alice',
      role: 'admin',
    })
  })
})
