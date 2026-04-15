// ============================================================
// NutriOS — Shared Types
// ============================================================

// --- Enums ---

export type UserRole = 'superadmin' | 'admin' | 'nutriologo' | 'recepcionista' | 'paciente'

export type MealType = 'desayuno' | 'colacion_am' | 'comida' | 'colacion_pm' | 'cena' | 'extra'

export type SMAEGroup =
  | 'cereales'
  | 'leguminosas'
  | 'verduras'
  | 'frutas'
  | 'lacteos'
  | 'proteinas_animales'
  | 'grasas'
  | 'azucares'

export type PurchaseUnit = 'g' | 'kg' | 'pieza' | 'litro' | 'ml'

export type AppointmentType = 'presencial' | 'virtual' | 'seguimiento'

export type DietPlanStatus = 'draft' | 'active' | 'completed' | 'cancelled'

export type GroceryPeriod = 1 | 3 | 5 | 7

// --- Macros ---

export interface Macros {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number
}

export interface MacroTargets extends Macros {
  protein_pct: number
  carbs_pct: number
  fat_pct: number
}

// --- SMAE ---

export interface SMAEEquivalents {
  cereales: number
  leguminosas: number
  verduras: number
  frutas: number
  lacteos: number
  proteinas_animales: number
  grasas: number
  azucares: number
}

// --- Diet Plan Structures ---

export interface MealItem {
  id: string
  food_id: string
  food_name: string
  quantity_g: number
  quantity_display: string
  unit: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  smae_group: SMAEGroup
  smae_equivalents: number
  position: number
  notes?: string
}

export interface Meal {
  id: string
  meal_type: MealType
  name: string
  position: number
  items: MealItem[]
  total_kcal: number
  macros: Macros
}

export interface DietDay {
  id: string
  day_label: string
  position: number
  meals: Meal[]
  total_kcal: number
  macros: Macros
}

// --- Grocery ---

export interface GroceryItem {
  food_id: string
  food_name: string
  smae_group: SMAEGroup
  total_quantity_g: number
  purchase_unit: PurchaseUnit
  purchase_quantity: number
  display_quantity: string
  checked: boolean
}

// --- Allergen ---

export interface AllergenWarning {
  food_id: string
  food_name: string
  allergen: string
  meal_type: MealType
  day_label: string
}
