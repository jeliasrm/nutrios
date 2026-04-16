import { describe, it, expect, vi } from 'vitest'
import { dietPlanTemplatesRouter } from './dietPlanTemplates'
import { createFakeContext, defaultUser } from '../test-utils'

const UUID = '11111111-1111-1111-1111-111111111111'

describe('dietPlanTemplatesRouter', () => {
  describe('list', () => {
    it('scope=mine filters by createdBy', async () => {
      const findMany = vi.fn().mockResolvedValue([])
      const tx = { dietPlanTemplate: { findMany } }
      const caller = dietPlanTemplatesRouter.createCaller(createFakeContext({ tx }))
      await caller.list({ scope: 'mine' })
      const args = findMany.mock.calls[0]?.[0] as { where: { createdBy: string } }
      expect(args.where.createdBy).toBe('user-1')
    })

    it('scope=tenant filters by tenantId', async () => {
      const findMany = vi.fn().mockResolvedValue([])
      const tx = { dietPlanTemplate: { findMany } }
      const caller = dietPlanTemplatesRouter.createCaller(createFakeContext({ tx }))
      await caller.list({ scope: 'tenant' })
      const args = findMany.mock.calls[0]?.[0] as { where: { tenantId: string } }
      expect(args.where.tenantId).toBe('tenant-a')
    })

    it('scope=global filters by tenantId=null', async () => {
      const findMany = vi.fn().mockResolvedValue([])
      const tx = { dietPlanTemplate: { findMany } }
      const caller = dietPlanTemplatesRouter.createCaller(createFakeContext({ tx }))
      await caller.list({ scope: 'global' })
      const args = findMany.mock.calls[0]?.[0] as { where: { tenantId: null } }
      expect(args.where.tenantId).toBeNull()
    })
  })

  describe('getById', () => {
    it('throws NOT_FOUND when missing', async () => {
      const tx = { dietPlanTemplate: { findUnique: vi.fn().mockResolvedValue(null) } }
      const caller = dietPlanTemplatesRouter.createCaller(createFakeContext({ tx }))
      await expect(caller.getById(UUID)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  describe('saveFromPlan', () => {
    it('snapshots plan days into templateDays field', async () => {
      const plan = {
        id: 'p1',
        totalKcal: 2000,
        macros: {},
        smaeEquivalents: {},
        days: [
          {
            dayLabel: 'Lun',
            position: 0,
            meals: [
              {
                mealType: 'desayuno',
                name: 'Des',
                position: 0,
                items: [
                  { foodId: 'f1', quantityG: { toNumber: () => 90 }, position: 0, notes: null },
                ],
              },
            ],
          },
        ],
      }
      const planFind = vi.fn().mockResolvedValue(plan)
      const tplCreate = vi.fn().mockResolvedValue({ id: 'tpl1' })
      const tx = {
        dietPlan: { findUnique: planFind },
        dietPlanTemplate: { create: tplCreate },
      }
      const caller = dietPlanTemplatesRouter.createCaller(createFakeContext({ tx }))
      await caller.saveFromPlan({
        plan_id: UUID,
        name: 'My Template',
        scope: 'tenant',
        tags: ['control'],
      })

      expect(tplCreate).toHaveBeenCalledOnce()
      const data = (
        tplCreate.mock.calls[0]?.[0] as {
          data: { templateDays: { days: unknown[] }; createdBy: string }
        }
      ).data
      expect(data.templateDays.days).toHaveLength(1)
      expect(data.createdBy).toBe('user-1')
    })

    it('throws NOT_FOUND when plan missing', async () => {
      const tx = { dietPlan: { findUnique: vi.fn().mockResolvedValue(null) } }
      const caller = dietPlanTemplatesRouter.createCaller(createFakeContext({ tx }))
      await expect(
        caller.saveFromPlan({ plan_id: UUID, name: 'X', scope: 'mine', tags: [] }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('rejected for paciente', async () => {
      const caller = dietPlanTemplatesRouter.createCaller(
        createFakeContext({ user: defaultUser('paciente') }),
      )
      await expect(
        caller.saveFromPlan({ plan_id: UUID, name: 'X', scope: 'mine', tags: [] }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })

  describe('update', () => {
    it('updates template name', async () => {
      const update = vi.fn().mockResolvedValue({ id: UUID, name: 'New name' })
      const tx = { dietPlanTemplate: { update } }
      const caller = dietPlanTemplatesRouter.createCaller(createFakeContext({ tx }))
      await caller.update({ id: UUID, name: 'New name' })
      expect(update).toHaveBeenCalledOnce()
    })
  })

  describe('delete', () => {
    it('deletes template', async () => {
      const deleteFn = vi.fn().mockResolvedValue({})
      const tx = { dietPlanTemplate: { delete: deleteFn } }
      const caller = dietPlanTemplatesRouter.createCaller(createFakeContext({ tx }))
      const res = await caller.delete(UUID)
      expect(res.ok).toBe(true)
    })
  })
})
