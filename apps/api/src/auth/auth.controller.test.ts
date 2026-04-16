import { describe, it, expect, vi } from 'vitest'
import { AuthController } from './auth.controller'
import type { AuthService } from './auth.service'
import type { AuthUser, AuthTokens } from './auth.types'

const tokens: AuthTokens = {
  accessToken: 'at',
  refreshToken: 'rt',
  accessExpiresAt: new Date(Date.now() + 900_000).toISOString(),
}
const user: AuthUser = {
  id: 'u1',
  tenantId: 't1',
  email: 'a@b.c',
  name: 'A',
  role: 'admin',
}

describe('AuthController', () => {
  it('delegates registerTenant to service', async () => {
    const svc = {
      registerTenant: vi.fn().mockResolvedValue({ user, tokens }),
    } as unknown as AuthService
    const c = new AuthController(svc)
    const result = await c.registerTenant({
      tenantName: 'X',
      subdomain: 'x',
      adminEmail: 'a@b.c',
      adminName: 'A',
      adminPassword: 'password123',
    })
    expect(result.user).toEqual(user)
    expect(svc.registerTenant).toHaveBeenCalledOnce()
  })

  it('delegates login to service', async () => {
    const svc = { login: vi.fn().mockResolvedValue({ user, tokens }) } as unknown as AuthService
    const c = new AuthController(svc)
    const result = await c.login({ email: 'a@b.c', password: 'password123' })
    expect(result.tokens).toEqual(tokens)
  })

  it('delegates refresh to service', async () => {
    const svc = { refresh: vi.fn().mockResolvedValue({ user, tokens }) } as unknown as AuthService
    const c = new AuthController(svc)
    const result = await c.refresh({ refreshToken: 'abc' })
    expect(result.user.id).toBe('u1')
  })

  it('delegates logout to service and returns void', async () => {
    const svc = { logout: vi.fn().mockResolvedValue(undefined) } as unknown as AuthService
    const c = new AuthController(svc)
    await expect(c.logout({ refreshToken: 'abc' })).resolves.toBeUndefined()
    expect(svc.logout).toHaveBeenCalledWith('abc')
  })
})
