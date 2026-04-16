import { describe, it, expect, vi } from 'vitest'
import { groceryListRouter } from './groceryList'
import { createFakeContext, createInMemoryRedis } from '../test-utils'

const PLAN_ID = '11111111-1111-1111-1111-111111111111'

function buildPlan() {
  return {
    id: PLAN_ID,
    days: [
      {
        id: 'd1',
        dayLabel: 'Lun',
        position: 0,
        totalKcal: 500,
        meals: [
          {
            id: 'm1',
            mealType: 'desayuno',
            name: 'Desayuno',
            position: 0,
            totalKcal: 500,
            items: [
              {
                id: 'i1',
                foodId: 'f-pollo',
                quantityG: 150,
                quantityDisplay: '150 g',
                unit: 'g',
                kcal: 247.5,
                proteinG: 46.5,
                carbsG: 0,
                fatG: 5.4,
                smaeGroup: 'proteinas_animales',
                smaeEquivalents: 5,
                position: 0,
              },
            ],
          },
        ],
      },
    ],
  }
}

describe('groceryListRouter', () => {
  describe('generate', () => {
    it('computes from DB, caches in Redis, returns items + generatedAt', async () => {
      const redis = createInMemoryRedis()
      const tx = {
        dietPlan: { findUnique: vi.fn().mockResolvedValue(buildPlan()) },
        foodCatalog: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'f-pollo',
              name: 'Pechuga de pollo',
              smaeGroup: 'proteinas_animales',
              purchaseUnit: 'kg',
              gPerPiece: null,
              commercialRoundup: 500,
            },
          ]),
        },
      }
      const caller = groceryListRouter.createCaller(createFakeContext({ tx, redis }))

      const res = await caller.generate({ dietPlanId: PLAN_ID, period: 7 })

      expect(res.items).toHaveLength(1)
      const item = res.items[0]
      if (!item) throw new Error('missing grocery item')
      expect(item.food_name).toBe('Pechuga de pollo')
      expect(item.smae_group).toBe('proteinas_animales')
      // 150g × 7 = 1050g → kg: 1.05 → ceil to 500g roundup → 1500g = 1.5 kg
      expect(item.display_quantity).toMatch(/kg$/)
      // Cached
      expect(redis.store.size).toBe(1)
      const key = Array.from(redis.store.keys())[0]
      expect(key).toBe(`grocery:${PLAN_ID}:7:0`)
    })

    it('returns cached payload on second call without hitting DB', async () => {
      const redis = createInMemoryRedis()
      const cached = { items: [{ food_id: 'f1' }], generatedAt: '2026-04-15T00:00:00Z' }
      redis.store.set(`grocery:${PLAN_ID}:3:0`, JSON.stringify(cached))

      const findUnique = vi.fn()
      const tx = { dietPlan: { findUnique }, foodCatalog: { findMany: vi.fn() } }
      const caller = groceryListRouter.createCaller(createFakeContext({ tx, redis }))

      const res = await caller.generate({ dietPlanId: PLAN_ID, period: 3 })

      expect(res).toEqual(cached)
      expect(findUnique).not.toHaveBeenCalled()
    })

    it('throws NOT_FOUND when plan missing', async () => {
      const tx = {
        dietPlan: { findUnique: vi.fn().mockResolvedValue(null) },
        foodCatalog: { findMany: vi.fn() },
      }
      const caller = groceryListRouter.createCaller(createFakeContext({ tx }))
      await expect(caller.generate({ dietPlanId: PLAN_ID, period: 1 })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      })
    })
  })

  describe('getAsWhatsAppText', () => {
    it('requires prior generate call (PRECONDITION_FAILED)', async () => {
      const caller = groceryListRouter.createCaller(createFakeContext())
      await expect(
        caller.getAsWhatsAppText({ dietPlanId: PLAN_ID, period: 7 }),
      ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' })
    })

    it('formats by category with emojis + wa.me deep link', async () => {
      const redis = createInMemoryRedis()
      redis.store.set(
        `grocery:${PLAN_ID}:3:0`,
        JSON.stringify({
          generatedAt: '2026-04-15T00:00:00Z',
          items: [
            {
              food_id: 'f-pollo',
              food_name: 'Pechuga de pollo',
              smae_group: 'proteinas_animales',
              total_quantity_g: 1050,
              display_quantity: '1.5 kg',
              purchase_unit: 'kg',
            },
            {
              food_id: 'f-jito',
              food_name: 'Jitomate',
              smae_group: 'verduras',
              total_quantity_g: 480,
              display_quantity: '4 piezas',
              purchase_unit: 'pieza',
            },
          ],
        }),
      )
      const caller = groceryListRouter.createCaller(createFakeContext({ redis }))
      const res = await caller.getAsWhatsAppText({ dietPlanId: PLAN_ID, period: 3 })

      expect(res.text).toContain('🛒 Mi lista de despensa')
      expect(res.text).toContain('🥩 *Proteínas animales*')
      expect(res.text).toContain('🥦 *Verduras*')
      expect(res.text).toContain('Pechuga de pollo — 1.5 kg')
      expect(res.text).toContain('Jitomate — 4 piezas')
      expect(res.waDeepLink.startsWith('https://wa.me/?text=')).toBe(true)
      const encoded = res.waDeepLink.split('?text=')[1] ?? ''
      expect(decodeURIComponent(encoded)).toBe(res.text)
    })
  })
})
