import { TRPCError } from '@trpc/server'
import type { Prisma } from '@nutrios/db'
import {
  listTemplatesSchema,
  saveTemplateFromPlanSchema,
  updateTemplateSchema,
  uuidSchema,
} from '@nutrios/validations'
import { router, protectedProcedure, requireRoles } from '../trpc'

export const dietPlanTemplatesRouter = router({
  list: protectedProcedure.input(listTemplatesSchema).query(async ({ ctx, input }) => {
    return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
      const where =
        input.scope === 'mine'
          ? { createdBy: ctx.user.id }
          : input.scope === 'tenant'
            ? { tenantId: ctx.tenantId }
            : { tenantId: null }
      return tx.dietPlanTemplate.findMany({
        where: { ...where, ...(input.category ? { category: input.category } : {}) },
        orderBy: { updatedAt: 'desc' },
      })
    })
  }),

  getById: protectedProcedure.input(uuidSchema).query(async ({ ctx, input }) => {
    return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
      const tpl = await tx.dietPlanTemplate.findUnique({ where: { id: input } })
      if (!tpl) throw new TRPCError({ code: 'NOT_FOUND' })
      return tpl
    })
  }),

  saveFromPlan: protectedProcedure
    .use(requireRoles('nutriologo', 'admin'))
    .input(saveTemplateFromPlanSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
        const plan = await tx.dietPlan.findUnique({
          where: { id: input.plan_id },
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

        const templateDays = {
          days: plan.days.map((d) => ({
            day_label: d.dayLabel,
            position: d.position,
            meals: d.meals.map((m) => ({
              meal_type: m.mealType,
              name: m.name,
              position: m.position,
              items: m.items.map((i) => ({
                food_id: i.foodId,
                quantity_g: Number(i.quantityG),
                position: i.position,
                notes: i.notes,
              })),
            })),
          })),
        }

        return tx.dietPlanTemplate.create({
          data: {
            tenantId: input.scope === 'tenant' ? ctx.tenantId : ctx.tenantId,
            name: input.name,
            category: input.category ?? 'custom',
            targetKcal: Number(plan.totalKcal),
            macros: plan.macros as Prisma.InputJsonValue,
            smaeEquivalents: plan.smaeEquivalents as Prisma.InputJsonValue,
            templateDays: templateDays as Prisma.InputJsonValue,
            tags: input.tags,
            createdBy: ctx.user.id,
            isPublic: false,
          },
        })
      })
    }),

  update: protectedProcedure
    .use(requireRoles('nutriologo', 'admin'))
    .input(updateTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
        return tx.dietPlanTemplate.update({
          where: { id: input.id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.category !== undefined ? { category: input.category } : {}),
            ...(input.tags !== undefined ? { tags: input.tags } : {}),
          },
        })
      })
    }),

  delete: protectedProcedure
    .use(requireRoles('nutriologo', 'admin'))
    .input(uuidSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
        await tx.dietPlanTemplate.delete({ where: { id: input } })
        return { ok: true } as const
      })
    }),
})
