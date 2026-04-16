import { describe, it, expect, vi } from 'vitest'
import { dietPlansRouter } from './dietPlans'
import { createFakeContext, defaultUser } from '../test-utils'

describe('dietPlansRouter', () => {
  describe('create', () => {
    it('seeds 7 empty days (Lun..Dom) on plan create', async () => {
      const planCreate = vi.fn().mockResolvedValue({ id: 'plan-1' })
      const dayCreateMany = vi.fn().mockResolvedValue({ count: 7 })
      const tx = {
        dietPlan: { create: planCreate },
        dietPlanDay: { createMany: dayCreateMany },
      }
      const caller = dietPlansRouter.createCaller(createFakeContext({ tx }))

      const res = await caller.create({
        patient_id: '11111111-1111-1111-1111-111111111111',
        name: 'Plan de control',
        start_date: '2026-04-15',
        total_kcal: 2000,
        macros: { kcal: 2000, protein_g: 120, carbs_g: 250, fat_g: 70, fiber_g: 30 },
      })

      expect(res).toEqual({ id: 'plan-1' })
      const days = (
        dayCreateMany.mock.calls[0]?.[0] as { data: Array<{ dayLabel: string; position: number }> }
      ).data
      expect(days).toHaveLength(7)
      expect(days.map((d: { dayLabel: string }) => d.dayLabel)).toEqual([
        'Lun',
        'Mar',
        'Mié',
        'Jue',
        'Vie',
        'Sáb',
        'Dom',
      ])
      expect(days[0]?.position).toBe(0)
      expect(days[6]?.position).toBe(6)
    })

    it('rejected for recepcionista role', async () => {
      const caller = dietPlansRouter.createCaller(
        createFakeContext({ user: defaultUser('recepcionista') }),
      )
      await expect(
        caller.create({
          patient_id: '11111111-1111-1111-1111-111111111111',
          name: 'X',
          start_date: '2026-04-15',
          total_kcal: 2000,
          macros: { kcal: 2000, protein_g: 120, carbs_g: 250, fat_g: 70, fiber_g: 30 },
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })

  describe('activate', () => {
    it('flips status to active when plan exists', async () => {
      const findUnique = vi.fn().mockResolvedValue({ id: 'plan-1', status: 'draft' })
      const update = vi.fn().mockResolvedValue({ id: 'plan-1', status: 'active' })
      const caller = dietPlansRouter.createCaller(
        createFakeContext({
          tx: { dietPlan: { findUnique, update } },
        }),
      )

      const res = await caller.activate({ id: '11111111-1111-1111-1111-111111111111' })

      expect(update).toHaveBeenCalledWith({
        where: { id: '11111111-1111-1111-1111-111111111111' },
        data: { status: 'active' },
      })
      expect(res.status).toBe('active')
    })

    it('throws NOT_FOUND when plan missing', async () => {
      const caller = dietPlansRouter.createCaller(
        createFakeContext({
          tx: { dietPlan: { findUnique: vi.fn().mockResolvedValue(null) } },
        }),
      )
      await expect(
        caller.activate({ id: '11111111-1111-1111-1111-111111111111' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  describe('getById', () => {
    it('throws NOT_FOUND when plan missing', async () => {
      const caller = dietPlansRouter.createCaller(
        createFakeContext({
          tx: { dietPlan: { findUnique: vi.fn().mockResolvedValue(null) } },
        }),
      )
      await expect(caller.getById('11111111-1111-1111-1111-111111111111')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
    })
  })
})
