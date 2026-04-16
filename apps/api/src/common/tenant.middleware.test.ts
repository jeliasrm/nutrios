import { describe, it, expect, vi } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import type { Response } from 'express'
import { TenantMiddleware, type TenantRequest } from './tenant.middleware'

function makeReq(headerValue?: string): TenantRequest {
  const headers: Record<string, string> = headerValue ? { 'x-tenant-id': headerValue } : {}
  return {
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as TenantRequest
}

describe('TenantMiddleware', () => {
  const mw = new TenantMiddleware()
  const res = {} as Response

  it('attaches normalized tenantIdHeader when valid UUID', () => {
    const req = makeReq('AA0F85E4-0CB9-4848-BA75-3C08C7E6EDA7')
    const next = vi.fn()
    mw.use(req, res, next)
    expect(req.tenantIdHeader).toBe('aa0f85e4-0cb9-4848-ba75-3c08c7e6eda7')
    expect(next).toHaveBeenCalledOnce()
  })

  it('skips attaching when header absent', () => {
    const req = makeReq()
    const next = vi.fn()
    mw.use(req, res, next)
    expect(req.tenantIdHeader).toBeUndefined()
    expect(next).toHaveBeenCalledOnce()
  })

  it('throws on malformed UUID header', () => {
    const req = makeReq('not-a-uuid')
    const next = vi.fn()
    expect(() => mw.use(req, res, next)).toThrow(BadRequestException)
    expect(next).not.toHaveBeenCalled()
  })
})
