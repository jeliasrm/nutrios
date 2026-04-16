import { TRPCError } from '@trpc/server'
import {
  createAnthropometricSchema,
  createConsultationSchema,
  uuidSchema,
} from '@nutrios/validations'
import { router, protectedProcedure, requireRoles } from '../trpc'

export const consultationsRouter = router({
  listByPatient: protectedProcedure.input(uuidSchema).query(async ({ ctx, input }) => {
    return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
      return tx.consultation.findMany({
        where: { patientId: input },
        orderBy: { date: 'desc' },
        include: { anthropometrics: true, nutritionalDiagnosis: true },
      })
    })
  }),

  getById: protectedProcedure.input(uuidSchema).query(async ({ ctx, input }) => {
    return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
      const consult = await tx.consultation.findUnique({
        where: { id: input },
        include: {
          anthropometrics: true,
          nutritionalDiagnosis: true,
          foodRecall24h: true,
        },
      })
      if (!consult) throw new TRPCError({ code: 'NOT_FOUND' })
      return consult
    })
  }),

  create: protectedProcedure
    .use(requireRoles('nutriologo', 'admin'))
    .input(createConsultationSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
        return tx.consultation.create({
          data: {
            tenantId: ctx.tenantId,
            patientId: input.patient_id,
            nutritionistId: ctx.user.id,
            date: new Date(input.date),
            reason: input.reason,
            diagnosis: input.diagnosis,
            notes: input.notes,
          },
        })
      })
    }),
})

export const anthropometricsRouter = router({
  create: protectedProcedure
    .use(requireRoles('nutriologo', 'admin'))
    .input(createAnthropometricSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
        const bmi = input.weight_kg / (input.height_cm / 100) ** 2
        return tx.anthropometric.create({
          data: {
            consultationId: input.consultation_id,
            weightKg: input.weight_kg,
            heightCm: input.height_cm,
            bmi: Math.round(bmi * 10) / 10,
            bodyFatPct: input.body_fat_pct,
            muscleMassKg: input.muscle_mass_kg,
            waistCm: input.waist_cm,
            hipCm: input.hip_cm,
            armCm: input.arm_cm,
            calfCm: input.calf_cm,
          },
        })
      })
    }),

  listByConsultation: protectedProcedure.input(uuidSchema).query(async ({ ctx, input }) => {
    return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
      return tx.anthropometric.findMany({
        where: { consultationId: input },
        orderBy: { createdAt: 'desc' },
      })
    })
  }),
})
