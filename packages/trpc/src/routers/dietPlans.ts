import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import type { Prisma } from '@nutrios/db'
import { activateDietPlanSchema, createDietPlanSchema, uuidSchema } from '@nutrios/validations'
import { router, protectedProcedure, requireRoles } from '../trpc'

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const
const EMPTY_MACROS = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }
const EMPTY_SMAE = {
  cereales: 0,
  leguminosas: 0,
  verduras: 0,
  frutas: 0,
  lacteos: 0,
  proteinas_animales: 0,
  grasas: 0,
  azucares: 0,
}

export const dietPlansRouter = router({
  listByPatient: protectedProcedure.input(uuidSchema).query(async ({ ctx, input }) => {
    return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
      return tx.dietPlan.findMany({
        where: { patientId: input },
        orderBy: { createdAt: 'desc' },
      })
    })
  }),

  getById: protectedProcedure.input(uuidSchema).query(async ({ ctx, input }) => {
    return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
      const plan = await tx.dietPlan.findUnique({
        where: { id: input },
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
      return plan
    })
  }),

  create: protectedProcedure
    .use(requireRoles('nutriologo', 'admin'))
    .input(createDietPlanSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
        const plan = await tx.dietPlan.create({
          data: {
            tenantId: ctx.tenantId,
            patientId: input.patient_id,
            nutritionistId: ctx.user.id,
            templateId: input.template_id,
            name: input.name,
            startDate: new Date(input.start_date),
            endDate: input.end_date ? new Date(input.end_date) : null,
            totalKcal: input.total_kcal,
            macros: input.macros as Prisma.InputJsonValue,
            smaeEquivalents: EMPTY_SMAE as Prisma.InputJsonValue,
            status: 'draft',
            notes: input.notes,
          },
        })
        // Seed 7 empty days
        await tx.dietPlanDay.createMany({
          data: DAY_LABELS.map((label, idx) => ({
            dietPlanId: plan.id,
            dayLabel: label,
            position: idx,
            totalKcal: 0,
            macros: EMPTY_MACROS as Prisma.InputJsonValue,
          })),
        })
        return plan
      })
    }),

  activate: protectedProcedure
    .use(requireRoles('nutriologo', 'admin'))
    .input(activateDietPlanSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
        const plan = await tx.dietPlan.findUnique({ where: { id: input.id } })
        if (!plan) throw new TRPCError({ code: 'NOT_FOUND' })
        return tx.dietPlan.update({
          where: { id: input.id },
          data: { status: 'active' },
        })
      })
    }),

  delete: protectedProcedure
    .use(requireRoles('nutriologo', 'admin'))
    .input(uuidSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
        await tx.dietPlan.delete({ where: { id: input } })
        return { ok: true } as const
      })
    }),

  rename: protectedProcedure
    .use(requireRoles('nutriologo', 'admin'))
    .input(z.object({ id: uuidSchema, name: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
        return tx.dietPlan.update({
          where: { id: input.id },
          data: { name: input.name },
        })
      })
    }),
})
