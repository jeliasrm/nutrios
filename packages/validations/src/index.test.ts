import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  registerTenantSchema,
  refreshTokenSchema,
  createPatientSchema,
  createDietPlanSchema,
  groceryListSchema,
  addItemSchema,
  reorderItemsSchema,
  saveDaySchema,
  wizardInitSchema,
  foodSearchSchema,
  createFoodSchema,
  createConsultationSchema,
  createAnthropometricSchema,
  saveTemplateFromPlanSchema,
  updateTemplateSchema,
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

const uuid = '11111111-1111-4111-8111-111111111111'

describe('builder schemas', () => {
  it('addItemSchema requires meal_id + positive quantity', () => {
    expect(
      addItemSchema.safeParse({ meal_id: uuid, item: { food_id: uuid, quantity_g: 10 } }).success,
    ).toBe(true)
    expect(
      addItemSchema.safeParse({ meal_id: uuid, item: { food_id: uuid, quantity_g: 0 } }).success,
    ).toBe(false)
  })

  it('reorderItemsSchema requires at least one id', () => {
    expect(reorderItemsSchema.safeParse({ meal_id: uuid, ordered_ids: [] }).success).toBe(false)
    expect(reorderItemsSchema.safeParse({ meal_id: uuid, ordered_ids: [uuid] }).success).toBe(true)
  })

  it('saveDaySchema requires at least one meal', () => {
    expect(saveDaySchema.safeParse({ day_id: uuid, meals: [] }).success).toBe(false)
    const ok = saveDaySchema.safeParse({
      day_id: uuid,
      meals: [
        {
          meal_type: 'desayuno',
          name: 'Desayuno',
          position: 0,
          items: [{ food_id: uuid, quantity_g: 60, position: 0 }],
        },
      ],
    })
    expect(ok.success).toBe(true)
  })
})

describe('wizardInitSchema', () => {
  it('accepts a valid wizard payload', () => {
    const ok = wizardInitSchema.safeParse({
      template_id: uuid,
      patient_id: uuid,
      name: 'Plan A',
      start_date: '2026-04-20',
      target_kcal: 1800,
      protein_pct: 25,
      carbs_pct: 50,
      fat_pct: 25,
    })
    expect(ok.success).toBe(true)
  })

  it('rejects out-of-range macro distribution', () => {
    const bad = wizardInitSchema.safeParse({
      template_id: uuid,
      patient_id: uuid,
      name: 'Plan A',
      start_date: '2026-04-20',
      target_kcal: 1800,
      protein_pct: 1,
      carbs_pct: 50,
      fat_pct: 25,
    })
    expect(bad.success).toBe(false)
  })
})

describe('food catalog schemas', () => {
  it('foodSearchSchema requires non-empty query', () => {
    expect(foodSearchSchema.safeParse({ q: '' }).success).toBe(false)
    expect(foodSearchSchema.safeParse({ q: 'tortilla' }).success).toBe(true)
  })

  it('createFoodSchema accepts a full food record', () => {
    const ok = createFoodSchema.safeParse({
      name: 'Tortilla de maíz',
      kcal_per_100g: 218,
      protein_g: 5.7,
      carbs_g: 45.9,
      fat_g: 2.5,
      smae_group: 'cereales',
      smae_equiv_per_portion: 1,
      portion_size_g: 30,
      portion_label: '1 tortilla mediana',
      purchase_unit: 'pieza',
      g_per_piece: 30,
    })
    expect(ok.success).toBe(true)
  })
})

describe('consultation + anthro schemas', () => {
  it('accepts valid consultation payload', () => {
    const ok = createConsultationSchema.safeParse({
      patient_id: uuid,
      date: '2026-04-20T09:00:00.000Z',
      reason: 'Control mensual',
    })
    expect(ok.success).toBe(true)
  })

  it('rejects non-positive weight', () => {
    const bad = createAnthropometricSchema.safeParse({
      consultation_id: uuid,
      weight_kg: 0,
      height_cm: 170,
    })
    expect(bad.success).toBe(false)
  })
})

describe('template schemas', () => {
  it('saveTemplateFromPlanSchema defaults scope to mine', () => {
    const ok = saveTemplateFromPlanSchema.safeParse({ plan_id: uuid, name: 'Pérdida X' })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.scope).toBe('mine')
  })

  it('updateTemplateSchema allows partial changes', () => {
    const ok = updateTemplateSchema.safeParse({ id: uuid, name: 'Nuevo nombre' })
    expect(ok.success).toBe(true)
  })
})
