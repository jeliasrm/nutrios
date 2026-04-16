import { TRPCError } from '@trpc/server'
import bcrypt from 'bcryptjs'
import {
  createPatientSchema,
  listPatientsSchema,
  updatePatientSchema,
  uuidSchema,
} from '@nutrios/validations'
import { router, protectedProcedure, requireRoles } from '../trpc'

const BCRYPT_ROUNDS = 10
const PLACEHOLDER_PASSWORD = 'nutrios-portal-password-placeholder'

export const patientsRouter = router({
  list: protectedProcedure.input(listPatientsSchema).query(async ({ ctx, input }) => {
    return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
      const where = input.search
        ? {
            OR: [
              { user: { name: { contains: input.search, mode: 'insensitive' as const } } },
              { user: { email: { contains: input.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}
      const [rows, total] = await Promise.all([
        tx.patient.findMany({
          where,
          skip: input.skip,
          take: input.take,
          orderBy: { createdAt: 'desc' },
          include: { user: true },
        }),
        tx.patient.count({ where }),
      ])
      return { rows, total }
    })
  }),

  getById: protectedProcedure.input(uuidSchema).query(async ({ ctx, input }) => {
    return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
      const patient = await tx.patient.findUnique({
        where: { id: input },
        include: { user: true, consultations: { orderBy: { date: 'desc' }, take: 10 } },
      })
      if (!patient) throw new TRPCError({ code: 'NOT_FOUND' })
      return patient
    })
  }),

  create: protectedProcedure
    .use(requireRoles('admin', 'nutriologo', 'recepcionista'))
    .input(createPatientSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
        const existing = await tx.user.findFirst({
          where: { email: input.email.toLowerCase() },
        })
        if (existing) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Email ya registrado' })
        }

        const passwordHash = await bcrypt.hash(PLACEHOLDER_PASSWORD, BCRYPT_ROUNDS)
        const user = await tx.user.create({
          data: {
            tenantId: ctx.tenantId,
            email: input.email.toLowerCase(),
            name: input.name,
            role: 'paciente',
            password: passwordHash,
            phone: input.phone,
          },
        })
        return tx.patient.create({
          data: {
            tenantId: ctx.tenantId,
            userId: user.id,
            dob: new Date(input.dob),
            sex: input.sex,
            allergies: input.allergies,
            chronicConditions: input.chronic_conditions,
          },
          include: { user: true },
        })
      })
    }),

  update: protectedProcedure
    .use(requireRoles('admin', 'nutriologo', 'recepcionista'))
    .input(updatePatientSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
        const { id, allergies, chronic_conditions, name, phone, dob, sex, email } = input
        const patient = await tx.patient.findUnique({ where: { id }, include: { user: true } })
        if (!patient) throw new TRPCError({ code: 'NOT_FOUND' })

        if (name || phone || email) {
          await tx.user.update({
            where: { id: patient.userId },
            data: {
              ...(name !== undefined ? { name } : {}),
              ...(phone !== undefined ? { phone } : {}),
              ...(email !== undefined ? { email: email.toLowerCase() } : {}),
            },
          })
        }

        return tx.patient.update({
          where: { id },
          data: {
            ...(dob !== undefined ? { dob: new Date(dob) } : {}),
            ...(sex !== undefined ? { sex } : {}),
            ...(allergies !== undefined ? { allergies } : {}),
            ...(chronic_conditions !== undefined ? { chronicConditions: chronic_conditions } : {}),
          },
          include: { user: true },
        })
      })
    }),
})
