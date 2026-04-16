import { TRPCError } from '@trpc/server'
import type { Prisma } from '@nutrios/db'
import {
  addItemSchema,
  duplicateDaySchema,
  removeItemSchema,
  reorderItemsSchema,
  saveDaySchema,
} from '@nutrios/validations'
import { calculateDayMacros, calculateMealMacros } from '@nutrios/diet-engine'
import type { Meal, MealItem } from '@nutrios/types'
import type { TxClient } from '../context'
import { router, protectedProcedure, requireRoles } from '../trpc'

/**
 * Recompute and persist kcal + macros for a meal, its parent day, and the plan.
 * Call after any mutation that changes items within a day.
 */
async function rollupDay(tx: TxClient, dayId: string): Promise<void> {
  const day = await tx.dietPlanDay.findUnique({
    where: { id: dayId },
    include: { meals: { include: { items: true } } },
  })
  if (!day) return

  const mealsForEngine: Meal[] = day.meals.map((m) => ({
    id: m.id,
    meal_type: m.mealType as Meal['meal_type'],
    name: m.name,
    position: m.position,
    items: m.items.map(itemToEngine),
    total_kcal: Number(m.totalKcal),
    macros: m.macros as unknown as Meal['macros'],
  }))

  // Persist each meal's macros from engine
  for (const meal of mealsForEngine) {
    const macros = calculateMealMacros(meal.items)
    await tx.dietPlanMeal.update({
      where: { id: meal.id },
      data: {
        totalKcal: macros.kcal,
        macros: macros as unknown as Prisma.InputJsonValue,
      },
    })
  }
  const dayMacros = calculateDayMacros(mealsForEngine)
  await tx.dietPlanDay.update({
    where: { id: dayId },
    data: {
      totalKcal: dayMacros.kcal,
      macros: dayMacros as unknown as Prisma.InputJsonValue,
    },
  })
}

function itemToEngine(i: {
  id: string
  foodId: string
  quantityG: Prisma.Decimal
  quantityDisplay: string
  unit: string
  kcal: Prisma.Decimal
  proteinG: Prisma.Decimal
  carbsG: Prisma.Decimal
  fatG: Prisma.Decimal
  smaeGroup: string
  smaeEquivalents: Prisma.Decimal
  position: number
  notes: string | null
}): MealItem {
  return {
    id: i.id,
    food_id: i.foodId,
    food_name: '',
    quantity_g: Number(i.quantityG),
    quantity_display: i.quantityDisplay,
    unit: i.unit,
    kcal: Number(i.kcal),
    protein_g: Number(i.proteinG),
    carbs_g: Number(i.carbsG),
    fat_g: Number(i.fatG),
    fiber_g: 0,
    smae_group: i.smaeGroup as MealItem['smae_group'],
    smae_equivalents: Number(i.smaeEquivalents),
    position: i.position,
    notes: i.notes ?? undefined,
  }
}

export const dietPlanBuilderRouter = router({
  saveDay: protectedProcedure
    .use(requireRoles('nutriologo', 'admin'))
    .input(saveDaySchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
        const day = await tx.dietPlanDay.findUnique({ where: { id: input.day_id } })
        if (!day) throw new TRPCError({ code: 'NOT_FOUND' })

        // Wipe existing meals + items (cascade via FK) then recreate.
        await tx.dietPlanMeal.deleteMany({ where: { dayId: day.id } })

        for (const meal of input.meals) {
          const foods = await tx.foodCatalog.findMany({
            where: { id: { in: meal.items.map((it) => it.food_id) } },
          })
          const foodById = new Map(foods.map((f) => [f.id, f]))

          const createdMeal = await tx.dietPlanMeal.create({
            data: {
              dayId: day.id,
              mealType: meal.meal_type,
              name: meal.name,
              position: meal.position,
              totalKcal: 0,
              macros: {} as Prisma.InputJsonValue,
            },
          })

          for (const it of meal.items) {
            const food = foodById.get(it.food_id)
            if (!food)
              throw new TRPCError({ code: 'BAD_REQUEST', message: `food ${it.food_id} not found` })
            const factor = it.quantity_g / Number(food.portionSizeG || 100)
            await tx.dietPlanMealItem.create({
              data: {
                mealId: createdMeal.id,
                foodId: food.id,
                quantityG: it.quantity_g,
                quantityDisplay: `${it.quantity_g} g`,
                unit: food.purchaseUnit,
                kcal: (Number(food.kcalPer100g) * it.quantity_g) / 100,
                proteinG: (Number(food.proteinG) * it.quantity_g) / 100,
                carbsG: (Number(food.carbsG) * it.quantity_g) / 100,
                fatG: (Number(food.fatG) * it.quantity_g) / 100,
                smaeGroup: food.smaeGroup,
                smaeEquivalents: Number(food.smaeEquivPerPortion) * factor,
                position: it.position,
                notes: it.notes,
              },
            })
          }
        }

        await rollupDay(tx, day.id)
        return { ok: true } as const
      })
    }),

  addItem: protectedProcedure
    .use(requireRoles('nutriologo', 'admin'))
    .input(addItemSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
        const meal = await tx.dietPlanMeal.findUnique({ where: { id: input.meal_id } })
        if (!meal) throw new TRPCError({ code: 'NOT_FOUND' })

        const food = await tx.foodCatalog.findUnique({ where: { id: input.item.food_id } })
        if (!food) throw new TRPCError({ code: 'BAD_REQUEST', message: 'food not found' })

        const factor = input.item.quantity_g / Number(food.portionSizeG || 100)
        const created = await tx.dietPlanMealItem.create({
          data: {
            mealId: meal.id,
            foodId: food.id,
            quantityG: input.item.quantity_g,
            quantityDisplay: `${input.item.quantity_g} g`,
            unit: food.purchaseUnit,
            kcal: (Number(food.kcalPer100g) * input.item.quantity_g) / 100,
            proteinG: (Number(food.proteinG) * input.item.quantity_g) / 100,
            carbsG: (Number(food.carbsG) * input.item.quantity_g) / 100,
            fatG: (Number(food.fatG) * input.item.quantity_g) / 100,
            smaeGroup: food.smaeGroup,
            smaeEquivalents: Number(food.smaeEquivPerPortion) * factor,
            position: input.item.position,
            notes: input.item.notes,
          },
        })
        await rollupDay(tx, meal.dayId)
        return created
      })
    }),

  removeItem: protectedProcedure
    .use(requireRoles('nutriologo', 'admin'))
    .input(removeItemSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
        const item = await tx.dietPlanMealItem.findUnique({
          where: { id: input.item_id },
          include: { meal: true },
        })
        if (!item) throw new TRPCError({ code: 'NOT_FOUND' })
        await tx.dietPlanMealItem.delete({ where: { id: item.id } })
        await rollupDay(tx, item.meal.dayId)
        return { ok: true } as const
      })
    }),

  reorderItems: protectedProcedure
    .use(requireRoles('nutriologo', 'admin'))
    .input(reorderItemsSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
        await Promise.all(
          input.ordered_ids.map((id, i) =>
            tx.dietPlanMealItem.update({ where: { id }, data: { position: i } }),
          ),
        )
        return { ok: true } as const
      })
    }),

  duplicateDay: protectedProcedure
    .use(requireRoles('nutriologo', 'admin'))
    .input(duplicateDaySchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
        const source = await tx.dietPlanDay.findUnique({
          where: { id: input.source_day_id },
          include: { meals: { include: { items: true } } },
        })
        if (!source) throw new TRPCError({ code: 'NOT_FOUND', message: 'source day not found' })
        const target = await tx.dietPlanDay.findUnique({ where: { id: input.target_day_id } })
        if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'target day not found' })

        await tx.dietPlanMeal.deleteMany({ where: { dayId: target.id } })
        for (const meal of source.meals) {
          const createdMeal = await tx.dietPlanMeal.create({
            data: {
              dayId: target.id,
              mealType: meal.mealType,
              name: meal.name,
              position: meal.position,
              totalKcal: meal.totalKcal,
              macros: meal.macros as Prisma.InputJsonValue,
            },
          })
          if (meal.items.length > 0) {
            await tx.dietPlanMealItem.createMany({
              data: meal.items.map((it) => ({
                mealId: createdMeal.id,
                foodId: it.foodId,
                quantityG: it.quantityG,
                quantityDisplay: it.quantityDisplay,
                unit: it.unit,
                kcal: it.kcal,
                proteinG: it.proteinG,
                carbsG: it.carbsG,
                fatG: it.fatG,
                smaeGroup: it.smaeGroup,
                smaeEquivalents: it.smaeEquivalents,
                position: it.position,
                notes: it.notes,
              })),
            })
          }
        }
        await rollupDay(tx, target.id)
        return { ok: true } as const
      })
    }),
})
