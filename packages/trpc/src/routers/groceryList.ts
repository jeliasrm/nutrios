import { TRPCError } from '@trpc/server'
import { groceryListSchema } from '@nutrios/validations'
import { calculateGroceryList } from '@nutrios/diet-engine'
import type { DietDay, GroceryItem, GroceryPeriod, SMAEGroup } from '@nutrios/types'
import { router, protectedProcedure } from '../trpc'

const CATEGORY_EMOJI: Record<SMAEGroup, string> = {
  proteinas_animales: '🥩',
  verduras: '🥦',
  frutas: '🍌',
  cereales: '🌾',
  leguminosas: '🫘',
  lacteos: '🥛',
  grasas: '🫙',
  azucares: '🍬',
}

const CATEGORY_LABEL: Record<SMAEGroup, string> = {
  proteinas_animales: 'Proteínas animales',
  verduras: 'Verduras',
  frutas: 'Frutas',
  cereales: 'Cereales y tubérculos',
  leguminosas: 'Leguminosas',
  lacteos: 'Lácteos',
  grasas: 'Grasas y aceites',
  azucares: 'Azúcares y varios',
}

function cacheKey(planId: string, period: GroceryPeriod, startDay?: number): string {
  return `grocery:${planId}:${period}:${startDay ?? 0}`
}

function toWhatsApp(items: GroceryItem[]): string {
  const byGroup = new Map<SMAEGroup, GroceryItem[]>()
  for (const it of items) {
    const list = byGroup.get(it.smae_group) ?? []
    list.push(it)
    byGroup.set(it.smae_group, list)
  }
  const lines: string[] = ['*🛒 Mi lista de despensa*', '']
  for (const [group, groupItems] of byGroup) {
    lines.push(`${CATEGORY_EMOJI[group]} *${CATEGORY_LABEL[group]}*`)
    for (const it of groupItems) {
      lines.push(`• ${it.food_name} — ${it.display_quantity}`)
    }
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}

export const groceryListRouter = router({
  generate: protectedProcedure.input(groceryListSchema).query(async ({ ctx, input }) => {
    const key = cacheKey(input.dietPlanId, input.period, input.startDay)
    const cached = await ctx.redis.get(key)
    if (cached) return JSON.parse(cached) as { items: GroceryItem[]; generatedAt: string }

    return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
      const plan = await tx.dietPlan.findUnique({
        where: { id: input.dietPlanId },
        include: {
          days: {
            orderBy: { position: 'asc' },
            include: {
              meals: {
                orderBy: { position: 'asc' },
                include: { items: { orderBy: { position: 'asc' } } },
              },
            },
          },
        },
      })
      if (!plan) throw new TRPCError({ code: 'NOT_FOUND' })

      const foodIds = new Set<string>()
      for (const d of plan.days)
        for (const m of d.meals) for (const i of m.items) foodIds.add(i.foodId)
      const foods = await tx.foodCatalog.findMany({ where: { id: { in: Array.from(foodIds) } } })
      const foodMap = new Map(
        foods.map((f) => [
          f.id,
          {
            food_id: f.id,
            food_name: f.name,
            smae_group: f.smaeGroup as SMAEGroup,
            purchase_unit: f.purchaseUnit as 'g' | 'kg' | 'pieza' | 'litro' | 'ml',
            g_per_piece: f.gPerPiece ? Number(f.gPerPiece) : null,
            commercial_roundup: Number(f.commercialRoundup),
          },
        ]),
      )

      const engineDays: DietDay[] = plan.days.map((d) => ({
        id: d.id,
        day_label: d.dayLabel,
        position: d.position,
        total_kcal: Number(d.totalKcal),
        macros: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
        meals: d.meals.map((m) => ({
          id: m.id,
          meal_type: m.mealType as 'desayuno',
          name: m.name,
          position: m.position,
          total_kcal: Number(m.totalKcal),
          macros: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
          items: m.items.map((i) => ({
            id: i.id,
            food_id: i.foodId,
            food_name: foodMap.get(i.foodId)?.food_name ?? '',
            quantity_g: Number(i.quantityG),
            quantity_display: i.quantityDisplay,
            unit: i.unit,
            kcal: Number(i.kcal),
            protein_g: Number(i.proteinG),
            carbs_g: Number(i.carbsG),
            fat_g: Number(i.fatG),
            fiber_g: 0,
            smae_group: i.smaeGroup as SMAEGroup,
            smae_equivalents: Number(i.smaeEquivalents),
            position: i.position,
          })),
        })),
      }))

      const items = calculateGroceryList(engineDays, input.period, foodMap)
      const payload = { items, generatedAt: new Date().toISOString() }
      await ctx.redis.setWithTTL(key, JSON.stringify(payload), 60 * 30)
      return payload
    })
  }),

  getAsWhatsAppText: protectedProcedure.input(groceryListSchema).query(async ({ ctx, input }) => {
    const key = cacheKey(input.dietPlanId, input.period, input.startDay)
    const cached = await ctx.redis.get(key)
    let items: GroceryItem[]
    if (cached) {
      items = (JSON.parse(cached) as { items: GroceryItem[] }).items
    } else {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Call groceryList.generate first',
      })
    }
    const text = toWhatsApp(items)
    return {
      text,
      waDeepLink: `https://wa.me/?text=${encodeURIComponent(text)}`,
    }
  }),
})
