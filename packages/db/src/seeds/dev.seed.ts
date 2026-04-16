import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const PASSWORD = 'password123'

async function hash(pwd: string): Promise<string> {
  return bcrypt.hash(pwd, 10)
}

async function wipe(): Promise<void> {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.document.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.availability.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.groceryListSave.deleteMany(),
    prisma.dietPlanMealItem.deleteMany(),
    prisma.dietPlanMeal.deleteMany(),
    prisma.dietPlanDay.deleteMany(),
    prisma.dietPlan.deleteMany(),
    prisma.dietPlanTemplate.deleteMany(),
    prisma.foodCatalog.deleteMany(),
    prisma.foodFrequency.deleteMany(),
    prisma.foodRecall24h.deleteMany(),
    prisma.nutritionalDiagnosis.deleteMany(),
    prisma.anthropometric.deleteMany(),
    prisma.consultation.deleteMany(),
    prisma.patient.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.user.deleteMany(),
    prisma.tenant.deleteMany(),
  ])
}

async function seedTenant(params: { name: string; subdomain: string }): Promise<{
  tenantId: string
  adminId: string
  nutritionistId: string
  receptionistId: string
  patientUserId: string
  patientId: string
}> {
  const tenant = await prisma.tenant.create({
    data: {
      name: params.name,
      subdomain: params.subdomain,
      plan: 'pro',
      status: 'active',
      subscriptions: {
        create: {
          plan: 'pro',
          status: 'active',
          seats: 5,
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    },
  })

  const pwd = await hash(PASSWORD)
  const prefix = params.subdomain

  const [admin, nutritionist, receptionist, patientUser] = await Promise.all([
    prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `admin@${prefix}.test`,
        name: 'Admin Demo',
        role: 'admin',
        password: pwd,
      },
    }),
    prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `nutri@${prefix}.test`,
        name: 'Nutrióloga Demo',
        role: 'nutriologo',
        password: pwd,
      },
    }),
    prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `recepcion@${prefix}.test`,
        name: 'Recepcionista Demo',
        role: 'recepcionista',
        password: pwd,
      },
    }),
    prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `paciente@${prefix}.test`,
        name: 'Paciente Demo',
        role: 'paciente',
        password: pwd,
      },
    }),
  ])

  const patient = await prisma.patient.create({
    data: {
      tenantId: tenant.id,
      userId: patientUser.id,
      dob: new Date('1990-01-15'),
      sex: 'F',
      bloodType: 'O+',
      allergies: ['nueces'],
      chronicConditions: [],
      curp: null,
      rfc: null,
    },
  })

  return {
    tenantId: tenant.id,
    adminId: admin.id,
    nutritionistId: nutritionist.id,
    receptionistId: receptionist.id,
    patientUserId: patientUser.id,
    patientId: patient.id,
  }
}

async function main(): Promise<void> {
  console.warn('→ Wiping database...')
  await wipe()

  console.warn('→ Creating superadmin...')
  const superadminTenant = await prisma.tenant.create({
    data: {
      name: 'NutriOS Platform',
      subdomain: 'platform',
      plan: 'internal',
      status: 'active',
    },
  })
  const pwd = await hash(PASSWORD)
  await prisma.user.create({
    data: {
      tenantId: superadminTenant.id,
      email: 'superadmin@nutrios.mx',
      name: 'Super Admin',
      role: 'superadmin',
      password: pwd,
    },
  })

  console.warn('→ Seeding tenant A (clinica-a)...')
  const a = await seedTenant({ name: 'Clínica A', subdomain: 'clinica-a' })

  console.warn('→ Seeding tenant B (clinica-b)...')
  const b = await seedTenant({ name: 'Clínica B', subdomain: 'clinica-b' })

  console.warn('\n✅ Seed dev completed')
  console.warn('Tenants:')
  console.warn(`  clinica-a: ${a.tenantId}`)
  console.warn(`  clinica-b: ${b.tenantId}`)
  console.warn('\nLogins (password: password123):')
  console.warn('  superadmin@nutrios.mx')
  console.warn(
    '  admin@clinica-a.test · nutri@clinica-a.test · recepcion@clinica-a.test · paciente@clinica-a.test',
  )
  console.warn(
    '  admin@clinica-b.test · nutri@clinica-b.test · recepcion@clinica-b.test · paciente@clinica-b.test',
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
