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

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20),
})

// --- Shared primitives ---

export const uuidSchema = z.string().uuid()

export const macrosSchema = z.object({
  kcal: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  fiber_g: z.number().nonnegative().optional(),
})

export const smaeGroupSchema = z.enum([
  'cereales',
  'leguminosas',
  'verduras',
  'frutas',
  'lacteos',
  'proteinas_animales',
  'grasas',
  'azucares',
])

export const mealTypeSchema = z.enum([
  'desayuno',
  'colacion_am',
  'comida',
  'colacion_pm',
  'cena',
  'extra',
])

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

export const updatePatientSchema = createPatientSchema.partial().extend({
  id: uuidSchema,
})

export const listPatientsSchema = z.object({
  search: z.string().optional(),
  skip: z.number().int().min(0).default(0),
  take: z.number().int().min(1).max(100).default(20),
})

// --- Consultations & Anthropometrics ---

export const createConsultationSchema = z.object({
  patient_id: uuidSchema,
  date: z.string().datetime(),
  reason: z.string().min(1).max(500),
  diagnosis: z.string().optional(),
  notes: z.string().optional(),
})

export const createAnthropometricSchema = z.object({
  consultation_id: uuidSchema,
  weight_kg: z.number().positive(),
  height_cm: z.number().positive(),
  body_fat_pct: z.number().min(0).max(100).optional(),
  muscle_mass_kg: z.number().positive().optional(),
  waist_cm: z.number().positive().optional(),
  hip_cm: z.number().positive().optional(),
  arm_cm: z.number().positive().optional(),
  calf_cm: z.number().positive().optional(),
})

// --- Food Catalog ---

export const foodSearchSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.number().int().min(1).max(50).default(20),
})

export const createFoodSchema = z.object({
  name: z.string().min(2).max(200),
  brand: z.string().optional(),
  kcal_per_100g: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  fiber_g: z.number().nonnegative().default(0),
  smae_group: smaeGroupSchema,
  smae_equiv_per_portion: z.number().nonnegative(),
  portion_size_g: z.number().positive(),
  portion_label: z.string().min(1).max(100),
  purchase_unit: z.enum(['g', 'kg', 'pieza', 'litro', 'ml']),
  g_per_piece: z.number().positive().nullable().optional(),
  commercial_roundup: z.number().positive().default(1),
  aliases: z.array(z.string()).default([]),
})

// --- Diet Plans ---

export const createDietPlanSchema = z.object({
  patient_id: uuidSchema,
  name: z.string().min(1).max(200),
  start_date: z.string().date(),
  end_date: z.string().date().optional(),
  total_kcal: z.number().positive(),
  macros: macrosSchema,
  template_id: uuidSchema.optional(),
  notes: z.string().optional(),
})

export const activateDietPlanSchema = z.object({
  id: uuidSchema,
})

// --- Diet Plan Builder ---

export const mealItemPayloadSchema = z.object({
  food_id: uuidSchema,
  quantity_g: z.number().positive(),
  position: z.number().int().min(0).default(0),
  notes: z.string().optional(),
})

export const addItemSchema = z.object({
  meal_id: uuidSchema,
  item: mealItemPayloadSchema,
})

export const removeItemSchema = z.object({
  item_id: uuidSchema,
})

export const reorderItemsSchema = z.object({
  meal_id: uuidSchema,
  ordered_ids: z.array(uuidSchema).min(1),
})

export const duplicateDaySchema = z.object({
  source_day_id: uuidSchema,
  target_day_id: uuidSchema,
})

export const saveDaySchema = z.object({
  day_id: uuidSchema,
  meals: z
    .array(
      z.object({
        meal_type: mealTypeSchema,
        name: z.string().min(1).max(100),
        position: z.number().int().min(0),
        items: z.array(mealItemPayloadSchema),
      }),
    )
    .min(1),
})

// --- Diet Plan Templates ---

export const saveTemplateFromPlanSchema = z.object({
  plan_id: uuidSchema,
  name: z.string().min(1).max(200),
  category: z.string().max(50).optional(),
  scope: z.enum(['mine', 'tenant']).default('mine'),
  tags: z.array(z.string()).default([]),
})

export const listTemplatesSchema = z.object({
  scope: z.enum(['mine', 'tenant', 'global']).default('mine'),
  category: z.string().optional(),
})

export const updateTemplateSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(200).optional(),
  category: z.string().max(50).optional(),
  tags: z.array(z.string()).optional(),
})

// --- Diet Plan Wizard ---

export const wizardInitSchema = z.object({
  template_id: uuidSchema,
  patient_id: uuidSchema,
  name: z.string().min(1).max(200),
  start_date: z.string().date(),
  target_kcal: z.number().positive(),
  protein_pct: z.number().min(5).max(60),
  carbs_pct: z.number().min(20).max(70),
  fat_pct: z.number().min(10).max(50),
})

export const wizardConfirmSchema = wizardInitSchema.extend({
  activate: z.boolean().default(false),
})

// --- Grocery List ---

export const groceryListSchema = z.object({
  dietPlanId: uuidSchema,
  period: z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(7)]),
  startDay: z.number().int().min(0).max(6).optional(),
})

// --- Inferred types ---
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterTenantInput = z.infer<typeof registerTenantSchema>
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>
export type CreatePatientInput = z.infer<typeof createPatientSchema>
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>
export type ListPatientsInput = z.infer<typeof listPatientsSchema>
export type CreateConsultationInput = z.infer<typeof createConsultationSchema>
export type CreateAnthropometricInput = z.infer<typeof createAnthropometricSchema>
export type FoodSearchInput = z.infer<typeof foodSearchSchema>
export type CreateFoodInput = z.infer<typeof createFoodSchema>
export type CreateDietPlanInput = z.infer<typeof createDietPlanSchema>
export type ActivateDietPlanInput = z.infer<typeof activateDietPlanSchema>
export type AddItemInput = z.infer<typeof addItemSchema>
export type RemoveItemInput = z.infer<typeof removeItemSchema>
export type ReorderItemsInput = z.infer<typeof reorderItemsSchema>
export type DuplicateDayInput = z.infer<typeof duplicateDaySchema>
export type SaveDayInput = z.infer<typeof saveDaySchema>
export type SaveTemplateFromPlanInput = z.infer<typeof saveTemplateFromPlanSchema>
export type ListTemplatesInput = z.infer<typeof listTemplatesSchema>
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>
export type WizardInitInput = z.infer<typeof wizardInitSchema>
export type WizardConfirmInput = z.infer<typeof wizardConfirmSchema>
export type GroceryListInput = z.infer<typeof groceryListSchema>
