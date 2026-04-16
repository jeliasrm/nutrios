import { describe, it, expect } from 'vitest'
import { ForbiddenException, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { RolesGuard } from './roles.guard'
import type { AuthUser, Role } from './auth.types'

function run(
  metadata: Role[] | undefined,
  user: AuthUser | undefined,
): { guard: RolesGuard; context: ExecutionContext } {
  const reflector = {
    getAllAndOverride: () => metadata,
  } as unknown as Reflector
  const guard = new RolesGuard(reflector)
  const request = { user }
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext
  return { guard, context }
}

const admin: AuthUser = {
  id: 'u1',
  tenantId: 't1',
  email: 'a@b.c',
  name: 'A',
  role: 'admin',
}

describe('RolesGuard', () => {
  it('allows when no roles metadata present', () => {
    const { guard, context } = run(undefined, admin)
    expect(guard.canActivate(context)).toBe(true)
  })

  it('allows when empty roles metadata', () => {
    const { guard, context } = run([], admin)
    expect(guard.canActivate(context)).toBe(true)
  })

  it('allows when user role is in metadata', () => {
    const { guard, context } = run(['admin', 'nutriologo'], admin)
    expect(guard.canActivate(context)).toBe(true)
  })

  it('throws ForbiddenException when user role not in metadata', () => {
    const { guard, context } = run(['nutriologo'], admin)
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException)
  })

  it('throws ForbiddenException when user absent', () => {
    const { guard, context } = run(['admin'], undefined)
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException)
  })
})
