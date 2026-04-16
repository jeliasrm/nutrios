import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Prisma, PrismaClient } from '@nutrios/db'
import bcrypt from 'bcryptjs'

// Prisma auto-loads packages/db/.env into process.env.DATABASE_URL at import time,
// so hard-code the URLs here to guarantee the e2e test uses the right roles.
const OWNER_URL = 'postgresql://nutrios:nutrios_dev@localhost:5434/nutrios_dev?schema=public'
const APP_URL = 'postgresql://nutrios_app:nutrios_app_dev@localhost:5434/nutrios_dev?schema=public'

let owner: PrismaClient
let app: PrismaClient
let tenantA = ''
let tenantB = ''

async function withTenant<T>(
  tenantId: string,
  fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$transaction'>) => Promise<T>,
): Promise<T> {
  return app.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT set_tenant(${tenantId}::uuid)`)
    return fn(tx as unknown as Omit<PrismaClient, '$connect' | '$disconnect' | '$transaction'>)
  })
}

describe('RLS tenant isolation', () => {
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
    // Fresh slate: wipe and reseed two tenants.
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

    const pwd = await bcrypt.hash('password123', 4)
    const a = await owner.tenant.create({
      data: { name: 'Clinica A', subdomain: 'clinica-a-rls', status: 'active' },
    })
    const b = await owner.tenant.create({
      data: { name: 'Clinica B', subdomain: 'clinica-b-rls', status: 'active' },
    })
    tenantA = a.id
    tenantB = b.id

    await owner.user.createMany({
      data: [
        { tenantId: tenantA, email: 'admin-a@test', name: 'A Admin', role: 'admin', password: pwd },
        {
          tenantId: tenantA,
          email: 'nutri-a@test',
          name: 'A Nutri',
          role: 'nutriologo',
          password: pwd,
        },
        { tenantId: tenantB, email: 'admin-b@test', name: 'B Admin', role: 'admin', password: pwd },
      ],
    })
  })

  it('tenant A sees only its own users', async () => {
    const users = await withTenant(tenantA, (tx) => tx.user.findMany())
    expect(users.length).toBe(2)
    expect(users.every((u) => u.tenantId === tenantA)).toBe(true)
  })

  it('tenant B sees only its own users', async () => {
    const users = await withTenant(tenantB, (tx) => tx.user.findMany())
    expect(users.length).toBe(1)
    expect(users[0]?.tenantId).toBe(tenantB)
  })

  it('tenant A cannot see tenant B records', async () => {
    const rowById = await withTenant(tenantA, (tx) =>
      tx.user.findUnique({
        where: { tenantId_email: { tenantId: tenantB, email: 'admin-b@test' } },
      }),
    )
    expect(rowById).toBeNull()
  })

  it('tenant A cannot INSERT a row for tenant B', async () => {
    await expect(
      withTenant(tenantA, (tx) =>
        tx.user.create({
          data: {
            tenantId: tenantB,
            email: 'hacker@test',
            name: 'Hacker',
            role: 'admin',
            password: 'x',
          },
        }),
      ),
    ).rejects.toThrow()
  })

  it('tenants table itself is also isolated', async () => {
    const rowsA = await withTenant(tenantA, (tx) => tx.tenant.findMany())
    expect(rowsA.length).toBe(1)
    expect(rowsA[0]?.id).toBe(tenantA)
  })

  it('no rows are visible without set_tenant', async () => {
    const users = await app.user.findMany()
    expect(users).toEqual([])
  })
})
