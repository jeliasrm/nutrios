import { describe, it, expect, vi } from 'vitest'
import { dietPlanWizardRouter } from './dietPlanWizard'
import { createFakeContext, defaultUser } from '../test-utils'

const UUID = '11111111-1111-1111-1111-111111111111'
const UUID2 = '22222222-2222-2222-2222-222222222222'

function mockDecimal(n: number) {
  return { toNumber: () => n, toString: () => String(n) } as unknown
}

const templateDays = {
  days: [
    {
      day_label: 'Lun',
      position: 0,
      meals: [
        {
          meal_type: 'desayuno',
          name: 'Desayuno',
          position: 0,
          items: [{ food_id: UUID2, quantity_g: 100, position: 0, notes: null }],
        },
      ],
    },
  ],
}

const foodRow = {
  id: UUID2,
  name: 'Tortilla de maíz',
  kcalPer100g: mockDecimal(218),
  proteinG: mockDecimal(5.7),
  carbsG: mockDecimal(45.9),
  fatG: mockDecimal(2.5),
  smaeGroup: 'cereales',
  smaeEquivPerPortion: mockDecimal(1),
  portionSizeG: mockDecimal(30),
}

const wizardInput = {
  template_id: UUID,
  patient_id: UUID2,
  name: 'Plan test',
  start_date: '2026-04-15',
  target_kcal: 1500,
  protein_pct: 25,
  carbs_pct: 50,
  fat_pct: 25,
}

describe('dietPlanWizardRouter', () => {
  describe('previewAdapted', () => {
    it('loads template + foods, adapts to target kcal, returns scale factor', async () => {
      const tplFind = vi.fn().mockResolvedValue({
        id: UUID,
        templateDays,
        smaeEquivalents: {},
      })
      const foodFind = vi.fn().mockResolvedValue([foodRow])
      const tx = {
        dietPlanTemplate: { findUnique: tplFind },
        foodCatalog: { findMany: foodFind },
      }
      const caller = dietPlanWizardRouter.createCaller(createFakeContext({ tx }))
      const res = await caller.previewAdapted(wizardInput)

      expect(res.targetKcal).toBe(1500)
      expect(res.scaleFactor).toBeGreaterThan(0)
      expect(res.days).toHaveLength(1)
    })

    it('throws NOT_FOUND when template missing', async () => {
      const tx = { dietPlanTemplate: { findUnique: vi.fn().mockResolvedValue(null) } }
      const caller = dietPlanWizardRouter.createCaller(createFakeContext({ tx }))
      await expect(caller.previewAdapted(wizardInput)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('rejected for recepcionista', async () => {
      const caller = dietPlanWizardRouter.createCaller(
        createFakeContext({ user: defaultUser('recepcionista') }),
      )
      await expect(caller.previewAdapted(wizardInput)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })

  describe('confirm', () => {
    it('creates plan + days + meals + items from template', async () => {
      const tplFind = vi.fn().mockResolvedValue({
        id: UUID,
        templateDays,
        smaeEquivalents: {},
      })
      const foodFind = vi.fn().mockResolvedValue([foodRow])
      const planCreate = vi.fn().mockResolvedValue({ id: 'plan-1' })
      const dayCreate = vi.fn().mockResolvedValue({ id: 'day-1' })
      const mealCreate = vi.fn().mockResolvedValue({ id: 'meal-1' })
      const itemCreateMany = vi.fn().mockResolvedValue({ count: 1 })

      const tx = {
        dietPlanTemplate: { findUnique: tplFind },
        foodCatalog: { findMany: foodFind },
        dietPlan: { create: planCreate },
        dietPlanDay: { create: dayCreate },
        dietPlanMeal: { create: mealCreate },
        dietPlanMealItem: { createMany: itemCreateMany },
      }
      const caller = dietPlanWizardRouter.createCaller(createFakeContext({ tx }))
      const res = await caller.confirm({ ...wizardInput, activate: false })

      expect(res.planId).toBe('plan-1')
      expect(planCreate).toHaveBeenCalledOnce()
      expect(dayCreate).toHaveBeenCalledOnce()
      expect(mealCreate).toHaveBeenCalledOnce()
      expect(itemCreateMany).toHaveBeenCalledOnce()

      const planData = (planCreate.mock.calls[0]?.[0] as { data: { status: string } }).data
      expect(planData.status).toBe('draft')
    })

    it('sets status=active when activate=true', async () => {
      const tplFind = vi.fn().mockResolvedValue({
        id: UUID,
        templateDays: { days: [] },
        smaeEquivalents: {},
      })
      const foodFind = vi.fn().mockResolvedValue([])
      const planCreate = vi.fn().mockResolvedValue({ id: 'plan-2' })

      const tx = {
        dietPlanTemplate: { findUnique: tplFind },
        foodCatalog: { findMany: foodFind },
        dietPlan: { create: planCreate },
      }
      const caller = dietPlanWizardRouter.createCaller(createFakeContext({ tx }))
      await caller.confirm({ ...wizardInput, activate: true })

      const data = (planCreate.mock.calls[0]?.[0] as { data: { status: string } }).data
      expect(data.status).toBe('active')
    })
  })
})
