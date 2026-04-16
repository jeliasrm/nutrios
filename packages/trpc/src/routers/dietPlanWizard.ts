import { TRPCError } from '@trpc/server'
import type { Prisma } from '@nutrios/db'
import { wizardConfirmSchema, wizardInitSchema } from '@nutrios/validations'
import { adaptTemplateToPlan } from '@nutrios/diet-engine'
import type { DietDay } from '@nutrios/types'
import { router, protectedProcedure, requireRoles } from '../trpc'

interface StoredTemplateDays {
  days?: Array<{
    day_label: string
    position: number
    meals: Array<{
      meal_type: string
      name: string
      position: number
      items: Array<{
        food_id: string
        quantity_g: number
        position: number
        notes: string | null
      }>
    }>
  }>
}

function toEngineDays(
  template: StoredTemplateDays,
  foods: Map<
    string,
    {
      kcalPer100g: Prisma.Decimal
      proteinG: Prisma.Decimal
      carbsG: Prisma.Decimal
      fatG: Prisma.Decimal
      smaeGroup: string
      smaeEquivPerPortion: Prisma.Decimal
      portionSizeG: Prisma.Decimal
      name: string
    }
  >,
): DietDay[] {
  return (template.days ?? []).map((d, di) => ({
    id: `t-d-${di}`,
    day_label: d.day_label,
    position: d.position,
    total_kcal: 0,
    macros: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
    meals: d.meals.map((m, mi) => ({
      id: `t-m-${di}-${mi}`,
      meal_type: m.meal_type as 'desayuno',
      name: m.name,
      position: m.position,
      total_kcal: 0,
      macros: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
      items: m.items.flatMap((it, ii) => {
        const food = foods.get(it.food_id)
        if (!food) return []
        const f = it.quantity_g / 100
        return [
          {
            id: `t-i-${di}-${mi}-${ii}`,
            food_id: it.food_id,
            food_name: food.name,
            quantity_g: it.quantity_g,
            quantity_display: `${it.quantity_g} g`,
            unit: 'g',
            kcal: Number(food.kcalPer100g) * f,
            protein_g: Number(food.proteinG) * f,
            carbs_g: Number(food.carbsG) * f,
            fat_g: Number(food.fatG) * f,
            fiber_g: 0,
            smae_group: food.smaeGroup as 'cereales',
            smae_equivalents:
              Number(food.smaeEquivPerPortion) * (it.quantity_g / Number(food.portionSizeG || 100)),
            position: it.position,
            notes: it.notes ?? undefined,
          },
        ]
      }),
    })),
  }))
}

export const dietPlanWizardRouter = router({
  previewAdapted: protectedProcedure
    .use(requireRoles('nutriologo', 'admin'))
    .input(wizardInitSchema)
    .query(async ({ ctx, input }) => {
      return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
        const template = await tx.dietPlanTemplate.findUnique({
          where: { id: input.template_id },
        })
        if (!template) throw new TRPCError({ code: 'NOT_FOUND' })
        const stored = template.templateDays as unknown as StoredTemplateDays
        const foodIds = new Set<string>()
        for (const d of stored.days ?? [])
          for (const m of d.meals) for (const i of m.items) foodIds.add(i.food_id)
        const foods = await tx.foodCatalog.findMany({ where: { id: { in: Array.from(foodIds) } } })
        const foodMap = new Map(foods.map((f) => [f.id, f]))
        const days = toEngineDays(stored, foodMap)
        const adapted = adaptTemplateToPlan(days, input.target_kcal)
        return {
          scaleFactor: adapted.scaleFactor,
          sourceKcal: adapted.sourceKcal,
          targetKcal: adapted.targetKcal,
          days: adapted.days,
        }
      })
    }),

  confirm: protectedProcedure
    .use(requireRoles('nutriologo', 'admin'))
    .input(wizardConfirmSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
        const template = await tx.dietPlanTemplate.findUnique({
          where: { id: input.template_id },
        })
        if (!template) throw new TRPCError({ code: 'NOT_FOUND' })

        const plan = await tx.dietPlan.create({
          data: {
            tenantId: ctx.tenantId,
            patientId: input.patient_id,
            nutritionistId: ctx.user.id,
            templateId: template.id,
            name: input.name,
            startDate: new Date(input.start_date),
            totalKcal: input.target_kcal,
            macros: {
              kcal: input.target_kcal,
              protein_g: (input.target_kcal * input.protein_pct) / 400,
              carbs_g: (input.target_kcal * input.carbs_pct) / 400,
              fat_g: (input.target_kcal * input.fat_pct) / 900,
            } as Prisma.InputJsonValue,
            smaeEquivalents: template.smaeEquivalents as Prisma.InputJsonValue,
            status: input.activate ? 'active' : 'draft',
          },
        })

        const stored = template.templateDays as unknown as StoredTemplateDays
        const foodIds = new Set<string>()
        for (const d of stored.days ?? [])
          for (const m of d.meals) for (const i of m.items) foodIds.add(i.food_id)
        const foods = await tx.foodCatalog.findMany({ where: { id: { in: Array.from(foodIds) } } })
        const foodMap = new Map(foods.map((f) => [f.id, f]))
        const adapted = adaptTemplateToPlan(toEngineDays(stored, foodMap), input.target_kcal)

        for (const day of adapted.days) {
          const createdDay = await tx.dietPlanDay.create({
            data: {
              dietPlanId: plan.id,
              dayLabel: day.day_label,
              position: day.position,
              totalKcal: day.total_kcal,
              macros: day.macros as unknown as Prisma.InputJsonValue,
            },
          })
          for (const meal of day.meals) {
            const createdMeal = await tx.dietPlanMeal.create({
              data: {
                dayId: createdDay.id,
                mealType: meal.meal_type,
                name: meal.name,
                position: meal.position,
                totalKcal: meal.total_kcal,
                macros: meal.macros as unknown as Prisma.InputJsonValue,
              },
            })
            if (meal.items.length > 0) {
              await tx.dietPlanMealItem.createMany({
                data: meal.items.map((it) => ({
                  mealId: createdMeal.id,
                  foodId: it.food_id,
                  quantityG: it.quantity_g,
                  quantityDisplay: it.quantity_display,
                  unit: it.unit,
                  kcal: it.kcal,
                  proteinG: it.protein_g,
                  carbsG: it.carbs_g,
                  fatG: it.fat_g,
                  smaeGroup: it.smae_group,
                  smaeEquivalents: it.smae_equivalents,
                  position: it.position,
                  notes: it.notes,
                })),
              })
            }
          }
        }

        return { planId: plan.id, scaleFactor: adapted.scaleFactor }
      })
    }),
})
