import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Prisma, PrismaClient } from '@nutrios/db'
import bcrypt from 'bcryptjs'

const OWNER_URL = 'postgresql://nutrios:nutrios_dev@localhost:5434/nutrios_dev?schema=public'
const APP_URL = 'postgresql://nutrios_app:nutrios_app_dev@localhost:5434/nutrios_dev?schema=public'

let owner: PrismaClient
let app: PrismaClient
let tenantA = ''
let tenantB = ''
let nutriA = ''
let nutriB = ''
let patientA = ''
let patientB = ''

async function withTenant<T>(
  tenantId: string,
  fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$transaction'>) => Promise<T>,
): Promise<T> {
  return app.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT set_tenant(${tenantId}::uuid)`)
    return fn(tx as unknown as Omit<PrismaClient, '$connect' | '$disconnect' | '$transaction'>)
  })
}

const EMPTY_MACROS = { kcal: 2000, protein_g: 120, carbs_g: 250, fat_g: 70, fiber_g: 30 }
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

describe('Diet plans: RLS isolation between tenants', () => {
  beforeAll(async () => {
    owner = new PrismaClient({ datasources: { db: { url: OWNER_URL } } })
    app = new PrismaClient({ datasources: { db: { url: APP_URL } } })
    await owner.$connect()
    await app.$connect()
  })

  afterAll(async () => {
    await owner.$disconnect()
    await app.$disconnect()
  })

  beforeEach(async () => {
    await owner.$transaction([
      owner.auditLog.deleteMany(),
      owner.notification.deleteMany(),
      owner.document.deleteMany(),
      owner.membership.deleteMany(),
      owner.invoice.deleteMany(),
      owner.payment.deleteMany(),
      owner.availability.deleteMany(),
      owner.appointment.deleteMany(),
      owner.groceryListSave.deleteMany(),
      owner.dietPlanMealItem.deleteMany(),
      owner.dietPlanMeal.deleteMany(),
      owner.dietPlanDay.deleteMany(),
      owner.dietPlan.deleteMany(),
      owner.dietPlanTemplate.deleteMany(),
      owner.foodCatalog.deleteMany(),
      owner.foodFrequency.deleteMany(),
      owner.foodRecall24h.deleteMany(),
      owner.nutritionalDiagnosis.deleteMany(),
      owner.anthropometric.deleteMany(),
      owner.consultation.deleteMany(),
      owner.patient.deleteMany(),
      owner.subscription.deleteMany(),
      owner.user.deleteMany(),
      owner.tenant.deleteMany(),
    ])

    const pwd = await bcrypt.hash('x', 4)
    const a = await owner.tenant.create({
      data: { name: 'Clinica A', subdomain: 'dp-clinica-a', status: 'active' },
    })
    const b = await owner.tenant.create({
      data: { name: 'Clinica B', subdomain: 'dp-clinica-b', status: 'active' },
    })
    tenantA = a.id
    tenantB = b.id

    const [nA, uA, nB, uB] = await Promise.all([
      owner.user.create({
        data: {
          tenantId: tenantA,
          email: 'n-a@t',
          name: 'Nutri A',
          role: 'nutriologo',
          password: pwd,
        },
      }),
      owner.user.create({
        data: {
          tenantId: tenantA,
          email: 'p-a@t',
          name: 'Paciente A',
          role: 'paciente',
          password: pwd,
        },
      }),
      owner.user.create({
        data: {
          tenantId: tenantB,
          email: 'n-b@t',
          name: 'Nutri B',
          role: 'nutriologo',
          password: pwd,
        },
      }),
      owner.user.create({
        data: {
          tenantId: tenantB,
          email: 'p-b@t',
          name: 'Paciente B',
          role: 'paciente',
          password: pwd,
        },
      }),
    ])
    nutriA = nA.id
    nutriB = nB.id

    const [pA, pB] = await Promise.all([
      owner.patient.create({
        data: {
          tenantId: tenantA,
          userId: uA.id,
          dob: new Date('1990-01-01'),
          sex: 'F',
          allergies: [],
          chronicConditions: [],
        },
      }),
      owner.patient.create({
        data: {
          tenantId: tenantB,
          userId: uB.id,
          dob: new Date('1990-01-01'),
          sex: 'M',
          allergies: [],
          chronicConditions: [],
        },
      }),
    ])
    patientA = pA.id
    patientB = pB.id

    await Promise.all([
      owner.dietPlan.create({
        data: {
          tenantId: tenantA,
          patientId: patientA,
          nutritionistId: nutriA,
          name: 'Plan A',
          startDate: new Date('2026-04-15'),
          totalKcal: 2000,
          macros: EMPTY_MACROS as Prisma.InputJsonValue,
          smaeEquivalents: EMPTY_SMAE as Prisma.InputJsonValue,
          status: 'draft',
        },
      }),
      owner.dietPlan.create({
        data: {
          tenantId: tenantB,
          patientId: patientB,
          nutritionistId: nutriB,
          name: 'Plan B',
          startDate: new Date('2026-04-15'),
          totalKcal: 1800,
          macros: EMPTY_MACROS as Prisma.InputJsonValue,
          smaeEquivalents: EMPTY_SMAE as Prisma.InputJsonValue,
          status: 'draft',
        },
      }),
    ])
  })

  it('tenant A sees only its diet plans', async () => {
    const rows = await withTenant(tenantA, (tx) => tx.dietPlan.findMany())
    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe('Plan A')
    expect(rows[0]?.tenantId).toBe(tenantA)
  })

  it('tenant B sees only its diet plans', async () => {
    const rows = await withTenant(tenantB, (tx) => tx.dietPlan.findMany())
    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe('Plan B')
  })

  it('tenant A cannot INSERT a diet plan for tenant B', async () => {
    await expect(
      withTenant(tenantA, (tx) =>
        tx.dietPlan.create({
          data: {
            tenantId: tenantB,
            patientId: patientB,
            nutritionistId: nutriB,
            name: 'Hijacked plan',
            startDate: new Date('2026-04-15'),
            totalKcal: 1500,
            macros: EMPTY_MACROS as Prisma.InputJsonValue,
            smaeEquivalents: EMPTY_SMAE as Prisma.InputJsonValue,
            status: 'draft',
          },
        }),
      ),
    ).rejects.toThrow()
  })

  it('tenant A cannot UPDATE tenant B plan (row not visible)', async () => {
    const result = await withTenant(tenantA, (tx) =>
      tx.dietPlan.updateMany({
        where: { tenantId: tenantB },
        data: { name: 'Hijacked' },
      }),
    )
    expect(result.count).toBe(0)
    const planB = await owner.dietPlan.findFirst({ where: { tenantId: tenantB } })
    expect(planB?.name).toBe('Plan B')
  })

  it('diet plan days are not reachable via parent when plan belongs to other tenant', async () => {
    // Seed a day on tenant B's plan (bypassing RLS as owner).
    const planB = await owner.dietPlan.findFirstOrThrow({ where: { tenantId: tenantB } })
    await owner.dietPlanDay.create({
      data: {
        dietPlanId: planB.id,
        dayLabel: 'Lun',
        position: 0,
        totalKcal: 0,
        macros: EMPTY_MACROS as Prisma.InputJsonValue,
      },
    })

    // From tenant A: fetching plan B by id should be NULL (plan itself is RLS-protected).
    const hijack = await withTenant(tenantA, (tx) =>
      tx.dietPlan.findUnique({
        where: { id: planB.id },
        include: { days: true },
      }),
    )
    expect(hijack).toBeNull()
  })

  it('food catalog: tenant-scoped rows isolated; global rows (tenant_id=null) visible', async () => {
    await owner.foodCatalog.createMany({
      data: [
        {
          tenantId: tenantA,
          name: 'Food A-only',
          kcalPer100g: 100,
          proteinG: 5,
          carbsG: 10,
          fatG: 2,
          fiberG: 1,
          smaeGroup: 'cereales',
          smaeEquivPerPortion: 1,
          portionSizeG: 30,
          portionLabel: 'x',
          purchaseUnit: 'g',
          commercialRoundup: 1,
          aliases: [],
          isVerified: false,
          isPublic: false,
        },
        {
          tenantId: null,
          name: 'Food Global',
          kcalPer100g: 100,
          proteinG: 5,
          carbsG: 10,
          fatG: 2,
          fiberG: 1,
          smaeGroup: 'cereales',
          smaeEquivPerPortion: 1,
          portionSizeG: 30,
          portionLabel: 'x',
          purchaseUnit: 'g',
          commercialRoundup: 1,
          aliases: [],
          isVerified: true,
          isPublic: true,
        },
      ],
    })

    const fromB = await withTenant(tenantB, (tx) =>
      tx.foodCatalog.findMany({ orderBy: { name: 'asc' } }),
    )
    const names = fromB.map((f) => f.name)
    expect(names).toContain('Food Global')
    expect(names).not.toContain('Food A-only')
  })
})
