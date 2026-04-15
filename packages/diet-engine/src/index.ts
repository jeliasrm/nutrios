import type {
  Macros,
  MealItem,
  Meal,
  DietDay,
  SMAEEquivalents,
  SMAEGroup,
  GroceryItem,
  GroceryPeriod,
  AllergenWarning,
  PurchaseUnit,
} from '@nutrios/types'

export function calculateMealMacros(items: MealItem[]): Macros {
  return items.reduce(
    (acc, item) => ({
      kcal: acc.kcal + item.kcal,
      protein_g: acc.protein_g + item.protein_g,
      carbs_g: acc.carbs_g + item.carbs_g,
      fat_g: acc.fat_g + item.fat_g,
      fiber_g: (acc.fiber_g ?? 0) + (item.fiber_g ?? 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 } as Macros,
  )
}

export function calculateDayMacros(meals: Meal[]): Macros {
  return meals.reduce(
    (acc, meal) => {
      const mealMacros = calculateMealMacros(meal.items)
      return {
        kcal: acc.kcal + mealMacros.kcal,
        protein_g: acc.protein_g + mealMacros.protein_g,
        carbs_g: acc.carbs_g + mealMacros.carbs_g,
        fat_g: acc.fat_g + mealMacros.fat_g,
        fiber_g: (acc.fiber_g ?? 0) + (mealMacros.fiber_g ?? 0),
      }
    },
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 } as Macros,
  )
}

export function calculatePlanMacros(days: DietDay[]): Macros {
  if (days.length === 0) {
    return { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }
  }

  const totals = days.reduce(
    (acc, day) => {
      const dayMacros = calculateDayMacros(day.meals)
      return {
        kcal: acc.kcal + dayMacros.kcal,
        protein_g: acc.protein_g + dayMacros.protein_g,
        carbs_g: acc.carbs_g + dayMacros.carbs_g,
        fat_g: acc.fat_g + dayMacros.fat_g,
        fiber_g: (acc.fiber_g ?? 0) + (dayMacros.fiber_g ?? 0),
      }
    },
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 } as Macros,
  )

  return {
    kcal: totals.kcal / days.length,
    protein_g: totals.protein_g / days.length,
    carbs_g: totals.carbs_g / days.length,
    fat_g: totals.fat_g / days.length,
    fiber_g: (totals.fiber_g ?? 0) / days.length,
  }
}

const SMAE_GROUPS: SMAEGroup[] = [
  'cereales',
  'leguminosas',
  'verduras',
  'frutas',
  'lacteos',
  'proteinas_animales',
  'grasas',
  'azucares',
]

export function calculateSMAEEquivalents(items: MealItem[]): SMAEEquivalents {
  const result: SMAEEquivalents = {
    cereales: 0,
    leguminosas: 0,
    verduras: 0,
    frutas: 0,
    lacteos: 0,
    proteinas_animales: 0,
    grasas: 0,
    azucares: 0,
  }

  for (const item of items) {
    if (SMAE_GROUPS.includes(item.smae_group)) {
      result[item.smae_group] += item.smae_equivalents
    }
  }

  return result
}

interface FoodCatalogInfo {
  food_id: string
  food_name: string
  smae_group: SMAEGroup
  purchase_unit: PurchaseUnit
  g_per_piece: number | null
  commercial_roundup: number
}

export function calculateGroceryList(
  days: DietDay[],
  period: GroceryPeriod,
  foodCatalog: Map<string, FoodCatalogInfo>,
): GroceryItem[] {
  if (days.length === 0) return []

  // 1. Select first N days (cyclic if plan has < N days)
  const selectedDays: DietDay[] = []
  for (let i = 0; i < period; i++) {
    const day = days[i % days.length]
    if (day) selectedDays.push(day)
  }

  // 2. Flatten all meal_items
  const itemsByFood = new Map<string, number>()
  for (const day of selectedDays) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        const current = itemsByFood.get(item.food_id) ?? 0
        itemsByFood.set(item.food_id, current + item.quantity_g)
      }
    }
  }

  // 3. Convert to purchase units with commercial roundup
  const groceryItems: GroceryItem[] = []
  for (const [foodId, totalG] of itemsByFood) {
    const catalog = foodCatalog.get(foodId)
    if (!catalog) continue

    let purchaseQty: number
    let displayQty: string

    switch (catalog.purchase_unit) {
      case 'kg':
        purchaseQty = totalG / 1000
        purchaseQty =
          Math.ceil(purchaseQty / (Number(catalog.commercial_roundup) / 1000)) *
          (Number(catalog.commercial_roundup) / 1000)
        displayQty = purchaseQty >= 1 ? `${purchaseQty} kg` : `${purchaseQty * 1000} g`
        break
      case 'pieza':
        if (catalog.g_per_piece && catalog.g_per_piece > 0) {
          purchaseQty = Math.ceil(totalG / catalog.g_per_piece)
        } else {
          purchaseQty = Math.ceil(totalG)
        }
        purchaseQty =
          Math.ceil(purchaseQty / Number(catalog.commercial_roundup)) *
          Number(catalog.commercial_roundup)
        displayQty = `${purchaseQty} pieza${purchaseQty !== 1 ? 's' : ''}`
        break
      case 'litro':
        purchaseQty = totalG / 1000
        purchaseQty =
          Math.ceil(purchaseQty / (Number(catalog.commercial_roundup) / 1000)) *
          (Number(catalog.commercial_roundup) / 1000)
        displayQty =
          purchaseQty >= 1
            ? `${purchaseQty} litro${purchaseQty !== 1 ? 's' : ''}`
            : `${purchaseQty * 1000} ml`
        break
      case 'ml':
        purchaseQty = totalG
        purchaseQty =
          Math.ceil(purchaseQty / Number(catalog.commercial_roundup)) *
          Number(catalog.commercial_roundup)
        displayQty = `${purchaseQty} ml`
        break
      case 'g':
      default:
        purchaseQty = totalG
        purchaseQty =
          Math.ceil(purchaseQty / Number(catalog.commercial_roundup)) *
          Number(catalog.commercial_roundup)
        displayQty = purchaseQty >= 1000 ? `${purchaseQty / 1000} kg` : `${purchaseQty} g`
        break
    }

    groceryItems.push({
      food_id: foodId,
      food_name: catalog.food_name,
      smae_group: catalog.smae_group,
      total_quantity_g: totalG,
      purchase_unit: catalog.purchase_unit,
      purchase_quantity: purchaseQty,
      display_quantity: displayQty,
      checked: false,
    })
  }

  // 6. Sort by SMAE group category
  const groupOrder: Record<SMAEGroup, number> = {
    proteinas_animales: 0,
    verduras: 1,
    frutas: 2,
    cereales: 3,
    leguminosas: 4,
    lacteos: 5,
    grasas: 6,
    azucares: 7,
  }

  groceryItems.sort((a, b) => groupOrder[a.smae_group] - groupOrder[b.smae_group])

  return groceryItems
}

export function detectAllergens(items: MealItem[], allergies: string[]): AllergenWarning[] {
  if (allergies.length === 0) return []

  const warnings: AllergenWarning[] = []
  const allergiesLower = allergies.map((a) => a.toLowerCase())

  for (const item of items) {
    const nameWords = item.food_name.toLowerCase()
    for (const allergen of allergiesLower) {
      if (nameWords.includes(allergen)) {
        warnings.push({
          food_id: item.food_id,
          food_name: item.food_name,
          allergen,
          meal_type: item.smae_group as never, // placeholder — real implementation checks from context
          day_label: '', // filled by caller
        })
      }
    }
  }

  return warnings
}

export {
  type Macros,
  type MealItem,
  type Meal,
  type DietDay,
  type SMAEEquivalents,
  type GroceryItem,
  type GroceryPeriod,
  type AllergenWarning,
} from '@nutrios/types'
