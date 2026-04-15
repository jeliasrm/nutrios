import { z } from 'zod'

// --- Auth ---

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

export const registerTenantSchema = z.object({
  tenantName: z.string().min(2).max(100),
  subdomain: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  adminEmail: z.string().email(),
  adminName: z.string().min(2).max(100),
  adminPassword: z.string().min(8),
})

// --- Patients ---

export const createPatientSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  dob: z.string().date(),
  sex: z.enum(['M', 'F']),
  phone: z.string().optional(),
  allergies: z.array(z.string()).default([]),
  chronic_conditions: z.array(z.string()).default([]),
})

// --- Diet Plans ---

export const createDietPlanSchema = z.object({
  patient_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  start_date: z.string().date(),
  end_date: z.string().date().optional(),
  total_kcal: z.number().positive(),
  macros: z.object({
    kcal: z.number().nonnegative(),
    protein_g: z.number().nonnegative(),
    carbs_g: z.number().nonnegative(),
    fat_g: z.number().nonnegative(),
  }),
})

export const groceryListSchema = z.object({
  dietPlanId: z.string().uuid(),
  period: z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(7)]),
  startDay: z.number().int().min(0).max(6).optional(),
})

// --- Re-exports ---
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterTenantInput = z.infer<typeof registerTenantSchema>
export type CreatePatientInput = z.infer<typeof createPatientSchema>
export type CreateDietPlanInput = z.infer<typeof createDietPlanSchema>
export type GroceryListInput = z.infer<typeof groceryListSchema>
