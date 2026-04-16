import { describe, it, expect, vi } from 'vitest'
import { TRPCError } from '@trpc/server'
import { patientsRouter } from './patients'
import { createFakeContext, defaultUser } from '../test-utils'

describe('patientsRouter', () => {
  describe('list', () => {
    it('returns rows + total pinned to tenant', async () => {
      const findMany = vi.fn().mockResolvedValue([{ id: 'p1' }])
      const count = vi.fn().mockResolvedValue(1)
      const tx = { patient: { findMany, count } }
      const ctx = createFakeContext({ tx })
      const caller = patientsRouter.createCaller(ctx)

      const res = await caller.list({ skip: 0, take: 20 })

      expect(res).toEqual({ rows: [{ id: 'p1' }], total: 1 })
      expect(findMany).toHaveBeenCalledOnce()
    })

    it('applies insensitive search on user.name and user.email', async () => {
      const findMany = vi.fn().mockResolvedValue([])
      const count = vi.fn().mockResolvedValue(0)
      const tx = { patient: { findMany, count } }
      const caller = patientsRouter.createCaller(createFakeContext({ tx }))

      await caller.list({ skip: 0, take: 20, search: 'ana' })

      const call = findMany.mock.calls[0]?.[0] as {
        where: { OR: Array<{ user: { name: { contains: string; mode: string } } }> }
      }
      expect(call.where.OR).toHaveLength(2)
      expect(call.where.OR[0]?.user.name.contains).toBe('ana')
      expect(call.where.OR[0]?.user.name.mode).toBe('insensitive')
    })
  })

  describe('auth guard', () => {
    it('rejects anonymous context with UNAUTHORIZED', async () => {
      const caller = patientsRouter.createCaller(createFakeContext({ user: null, tenantId: null }))
      await expect(caller.list({ skip: 0, take: 20 })).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      })
    })
  })

  describe('role guard (create)', () => {
    it('rejects paciente role with FORBIDDEN', async () => {
      const ctx = createFakeContext({ user: defaultUser('paciente') })
      const caller = patientsRouter.createCaller(ctx)
      await expect(
        caller.create({
          email: 'new@example.com',
          name: 'Ana',
          dob: '1990-01-01',
          sex: 'F',
          allergies: [],
          chronic_conditions: [],
        }),
      ).rejects.toBeInstanceOf(TRPCError)
    })

    it('rejects duplicate email with CONFLICT', async () => {
      const tx = {
        user: { findFirst: vi.fn().mockResolvedValue({ id: 'u-existing' }) },
      }
      const caller = patientsRouter.createCaller(createFakeContext({ tx }))

      await expect(
        caller.create({
          email: 'dup@example.com',
          name: 'Ana',
          dob: '1990-01-01',
          sex: 'F',
          allergies: [],
          chronic_conditions: [],
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT' })
    })
  })

  describe('getById', () => {
    it('throws NOT_FOUND when patient missing', async () => {
      const tx = { patient: { findUnique: vi.fn().mockResolvedValue(null) } }
      const caller = patientsRouter.createCaller(createFakeContext({ tx }))
      await expect(caller.getById('11111111-1111-1111-1111-111111111111')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
    })
  })
})
