import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  registerTenantSchema,
  refreshTokenSchema,
  createPatientSchema,
  createDietPlanSchema,
  groceryListSchema,
} from './index'

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '12345678' }).success).toBe(true)
  })

  it('rejects invalid email', () => {
    expect(loginSchema.safeParse({ email: 'not-email', password: '12345678' }).success).toBe(false)
  })

  it('rejects short passwords', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '123' }).success).toBe(false)
  })
})

describe('registerTenantSchema', () => {
  const valid = {
    tenantName: 'Clínica Salud',
    subdomain: 'salud-mx',
    adminEmail: 'admin@salud.mx',
    adminName: 'Dra. Ana',
    adminPassword: 'supersecret',
  }

  it('accepts valid tenant registration', () => {
    expect(registerTenantSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects subdomains with uppercase or spaces', () => {
    expect(registerTenantSchema.safeParse({ ...valid, subdomain: 'Salud MX' }).success).toBe(false)
  })

  it('rejects subdomains shorter than 3 chars', () => {
    expect(registerTenantSchema.safeParse({ ...valid, subdomain: 'ab' }).success).toBe(false)
  })
})

describe('createPatientSchema', () => {
  it('defaults allergies and chronic_conditions to []', () => {
    const parsed = createPatientSchema.parse({
      email: 'p@x.com',
      name: 'Luis',
      dob: '1990-01-15',
      sex: 'M',
    })
    expect(parsed.allergies).toEqual([])
    expect(parsed.chronic_conditions).toEqual([])
  })

  it('rejects invalid sex', () => {
    const result = createPatientSchema.safeParse({
      email: 'p@x.com',
      name: 'Luis',
      dob: '1990-01-15',
      sex: 'X',
    })
    expect(result.success).toBe(false)
  })

  it('rejects malformed date', () => {
    const result = createPatientSchema.safeParse({
      email: 'p@x.com',
      name: 'Luis',
      dob: '15/01/1990',
      sex: 'F',
    })
    expect(result.success).toBe(false)
  })
})

describe('createDietPlanSchema', () => {
  it('accepts valid plan payload', () => {
    const ok = createDietPlanSchema.safeParse({
      patient_id: '11111111-1111-4111-8111-111111111111',
      name: 'Plan pérdida de peso',
      start_date: '2026-04-15',
      total_kcal: 1800,
      macros: { kcal: 1800, protein_g: 100, carbs_g: 200, fat_g: 60 },
    })
    expect(ok.success).toBe(true)
  })

  it('rejects non-uuid patient_id', () => {
    const bad = createDietPlanSchema.safeParse({
      patient_id: 'abc',
      name: 'x',
      start_date: '2026-04-15',
      total_kcal: 1800,
      macros: { kcal: 1800, protein_g: 100, carbs_g: 200, fat_g: 60 },
    })
    expect(bad.success).toBe(false)
  })
})

describe('refreshTokenSchema', () => {
  it('accepts long token strings', () => {
    expect(refreshTokenSchema.safeParse({ refreshToken: 'a'.repeat(40) }).success).toBe(true)
  })

  it('rejects short token strings', () => {
    expect(refreshTokenSchema.safeParse({ refreshToken: 'short' }).success).toBe(false)
  })
})

describe('groceryListSchema', () => {
  it('accepts supported periods', () => {
    for (const period of [1, 3, 5, 7] as const) {
      const ok = groceryListSchema.safeParse({
        dietPlanId: '11111111-1111-4111-8111-111111111111',
        period,
      })
      expect(ok.success).toBe(true)
    }
  })

  it('rejects unsupported periods', () => {
    const bad = groceryListSchema.safeParse({
      dietPlanId: '11111111-1111-4111-8111-111111111111',
      period: 2,
    })
    expect(bad.success).toBe(false)
  })
})
