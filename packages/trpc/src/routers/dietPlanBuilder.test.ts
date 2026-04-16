import { describe, it, expect, vi } from 'vitest'
import { dietPlanBuilderRouter } from './dietPlanBuilder'
import { createFakeContext, defaultUser } from '../test-utils'

const UUID1 = '11111111-1111-1111-1111-111111111111'
const UUID2 = '22222222-2222-2222-2222-222222222222'
const UUID3 = '33333333-3333-3333-3333-333333333333'
const UUID4 = '44444444-4444-4444-4444-444444444444'
const UUID5 = '55555555-5555-5555-5555-555555555555'

function mockDecimal(n: number) {
  return { toNumber: () => n, toString: () => String(n) } as unknown
}

describe('dietPlanBuilderRouter', () => {
  describe('addItem', () => {
    it('creates item with computed macros + calls rollupDay', async () => {
      const mealFind = vi.fn().mockResolvedValue({ id: UUID2, dayId: UUID3 })
      const foodFind = vi.fn().mockResolvedValue({
        id: UUID4,
        kcalPer100g: mockDecimal(165),
        proteinG: mockDecimal(31),
        carbsG: mockDecimal(0),
        fatG: mockDecimal(3.6),
        smaeGroup: 'proteinas_animales',
        smaeEquivPerPortion: mockDecimal(1),
        portionSizeG: mockDecimal(30),
        purchaseUnit: 'g',
      })
      const itemCreate = vi.fn().mockResolvedValue({ id: UUID5 })
      const dayFind = vi.fn().mockResolvedValue({
        id: UUID3,
        meals: [
          {
            id: UUID2,
            mealType: 'desayuno',
            name: 'Des',
            position: 0,
            totalKcal: mockDecimal(0),
            macros: {},
            items: [],
          },
        ],
      })
      const mealUpdate = vi.fn().mockResolvedValue({})
      const dayUpdate = vi.fn().mockResolvedValue({})

      const tx = {
        dietPlanMeal: { findUnique: mealFind, update: mealUpdate },
        foodCatalog: { findUnique: foodFind },
        dietPlanMealItem: { create: itemCreate },
        dietPlanDay: { findUnique: dayFind, update: dayUpdate },
      }
      const caller = dietPlanBuilderRouter.createCaller(createFakeContext({ tx }))

      await caller.addItem({
        meal_id: UUID2,
        item: { food_id: UUID4, quantity_g: 90, position: 0 },
      })

      expect(itemCreate).toHaveBeenCalledOnce()
      const data = (itemCreate.mock.calls[0]?.[0] as { data: { kcal: number } }).data
      expect(data.kcal).toBeCloseTo(148.5, 0)
      expect(dayUpdate).toHaveBeenCalledOnce()
    })

    it('throws NOT_FOUND when meal missing', async () => {
      const tx = {
        dietPlanMeal: { findUnique: vi.fn().mockResolvedValue(null) },
      }
      const caller = dietPlanBuilderRouter.createCaller(createFakeContext({ tx }))
      await expect(
        caller.addItem({ meal_id: UUID1, item: { food_id: UUID4, quantity_g: 90, position: 0 } }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('throws BAD_REQUEST when food missing', async () => {
      const tx = {
        dietPlanMeal: { findUnique: vi.fn().mockResolvedValue({ id: UUID2, dayId: UUID3 }) },
        foodCatalog: { findUnique: vi.fn().mockResolvedValue(null) },
      }
      const caller = dietPlanBuilderRouter.createCaller(createFakeContext({ tx }))
      await expect(
        caller.addItem({ meal_id: UUID2, item: { food_id: UUID4, quantity_g: 90, position: 0 } }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })
  })

  describe('removeItem', () => {
    it('deletes item and calls rollupDay', async () => {
      const findUnique = vi.fn().mockResolvedValue({
        id: UUID1,
        meal: { id: UUID2, dayId: UUID3 },
      })
      const deleteItem = vi.fn().mockResolvedValue({})
      const dayFind = vi.fn().mockResolvedValue({ id: UUID3, meals: [] })
      const dayUpdate = vi.fn().mockResolvedValue({})

      const tx = {
        dietPlanMealItem: { findUnique, delete: deleteItem },
        dietPlanDay: { findUnique: dayFind, update: dayUpdate },
      }
      const caller = dietPlanBuilderRouter.createCaller(createFakeContext({ tx }))
      await caller.removeItem({ item_id: UUID1 })
      expect(deleteItem).toHaveBeenCalledOnce()
    })

    it('throws NOT_FOUND when item missing', async () => {
      const tx = {
        dietPlanMealItem: { findUnique: vi.fn().mockResolvedValue(null) },
      }
      const caller = dietPlanBuilderRouter.createCaller(createFakeContext({ tx }))
      await expect(caller.removeItem({ item_id: UUID1 })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
    })
  })

  describe('reorderItems', () => {
    it('updates position for each id', async () => {
      const update = vi.fn().mockResolvedValue({})
      const tx = { dietPlanMealItem: { update } }
      const caller = dietPlanBuilderRouter.createCaller(createFakeContext({ tx }))
      await caller.reorderItems({ meal_id: UUID1, ordered_ids: [UUID2, UUID3, UUID4] })
      expect(update).toHaveBeenCalledTimes(3)
    })

    it('rejected for paciente', async () => {
      const caller = dietPlanBuilderRouter.createCaller(
        createFakeContext({ user: defaultUser('paciente') }),
      )
      await expect(
        caller.reorderItems({ meal_id: UUID1, ordered_ids: [UUID2] }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })

  describe('duplicateDay', () => {
    it('copies meals+items from source to target', async () => {
      const source = {
        id: UUID1,
        meals: [
          {
            mealType: 'desayuno',
            name: 'Des',
            position: 0,
            totalKcal: mockDecimal(400),
            macros: {},
            items: [
              {
                foodId: UUID4,
                quantityG: mockDecimal(90),
                quantityDisplay: '90 g',
                unit: 'g',
                kcal: mockDecimal(148),
                proteinG: mockDecimal(28),
                carbsG: mockDecimal(0),
                fatG: mockDecimal(3.2),
                smaeGroup: 'proteinas_animales',
                smaeEquivalents: mockDecimal(3),
                position: 0,
                notes: null,
              },
            ],
          },
        ],
      }
      const dayFind = vi
        .fn()
        .mockResolvedValueOnce(source)
        .mockResolvedValueOnce({ id: UUID2 })
        .mockResolvedValueOnce({ id: UUID2, meals: [] })
      const mealDelete = vi.fn().mockResolvedValue({})
      const mealCreate = vi.fn().mockResolvedValue({ id: UUID3 })
      const itemCreateMany = vi.fn().mockResolvedValue({ count: 1 })
      const dayUpdate = vi.fn().mockResolvedValue({})

      const tx = {
        dietPlanDay: { findUnique: dayFind, update: dayUpdate },
        dietPlanMeal: { deleteMany: mealDelete, create: mealCreate, update: vi.fn() },
        dietPlanMealItem: { createMany: itemCreateMany },
      }
      const caller = dietPlanBuilderRouter.createCaller(createFakeContext({ tx }))
      const res = await caller.duplicateDay({ source_day_id: UUID1, target_day_id: UUID2 })
      expect(res.ok).toBe(true)
      expect(mealCreate).toHaveBeenCalledOnce()
      expect(itemCreateMany).toHaveBeenCalledOnce()
    })

    it('throws NOT_FOUND when source missing', async () => {
      const tx = {
        dietPlanDay: { findUnique: vi.fn().mockResolvedValue(null) },
      }
      const caller = dietPlanBuilderRouter.createCaller(createFakeContext({ tx }))
      await expect(
        caller.duplicateDay({ source_day_id: UUID1, target_day_id: UUID2 }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })
})
