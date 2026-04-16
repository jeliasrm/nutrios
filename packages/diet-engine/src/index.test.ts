import { describe, it, expect } from 'vitest'
import type { MealItem, Meal, DietDay, SMAEGroup, PurchaseUnit } from '@nutrios/types'
import {
  calculateMealMacros,
  calculateDayMacros,
  calculatePlanMacros,
  calculateSMAEEquivalents,
  calculateGroceryList,
  detectAllergens,
  adaptTemplateToPlan,
} from './index'

const makeItem = (over: Partial<MealItem> = {}): MealItem => ({
  id: 'it-1',
  food_id: 'f-1',
  food_name: 'Tortilla de maíz',
  quantity_g: 30,
  quantity_display: '1 tortilla',
  unit: 'pieza',
  kcal: 65,
  protein_g: 1.7,
  carbs_g: 13.8,
  fat_g: 0.8,
  fiber_g: 1.2,
  smae_group: 'cereales',
  smae_equivalents: 1,
  position: 0,
  ...over,
})

const makeMeal = (items: MealItem[], over: Partial<Meal> = {}): Meal => ({
  id: 'm-1',
  meal_type: 'desayuno',
  name: 'Desayuno',
  position: 0,
  items,
  total_kcal: items.reduce((a, i) => a + i.kcal, 0),
  macros: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  ...over,
})

const makeDay = (meals: Meal[], over: Partial<DietDay> = {}): DietDay => ({
  id: 'd-1',
  day_label: 'Lun',
  position: 0,
  meals,
  total_kcal: 0,
  macros: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  ...over,
})

describe('calculateMealMacros', () => {
  it('sums kcal and macros across items', () => {
    const items = [
      makeItem({ kcal: 100, protein_g: 10, carbs_g: 20, fat_g: 5, fiber_g: 2 }),
      makeItem({ kcal: 50, protein_g: 5, carbs_g: 10, fat_g: 2.5, fiber_g: 1 }),
    ]
    const result = calculateMealMacros(items)
    expect(result.kcal).toBe(150)
    expect(result.protein_g).toBe(15)
    expect(result.carbs_g).toBe(30)
    expect(result.fat_g).toBe(7.5)
    expect(result.fiber_g).toBe(3)
  })

  it('returns zeros for empty list', () => {
    expect(calculateMealMacros([])).toEqual({
      kcal: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
    })
  })

  it('handles items missing fiber_g as zero', () => {
    const item: MealItem = { ...makeItem(), fiber_g: undefined as unknown as number }
    expect(calculateMealMacros([item]).fiber_g).toBe(0)
  })
})

describe('calculateDayMacros', () => {
  it('sums meal macros across a day', () => {
    const day = [
      makeMeal([makeItem({ kcal: 100, protein_g: 10, carbs_g: 20, fat_g: 5, fiber_g: 2 })]),
      makeMeal([makeItem({ kcal: 200, protein_g: 20, carbs_g: 30, fat_g: 8, fiber_g: 3 })]),
    ]
    const result = calculateDayMacros(day)
    expect(result.kcal).toBe(300)
    expect(result.protein_g).toBe(30)
    expect(result.carbs_g).toBe(50)
    expect(result.fat_g).toBe(13)
    expect(result.fiber_g).toBe(5)
  })

  it('returns zeros for empty day', () => {
    expect(calculateDayMacros([])).toEqual({
      kcal: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
    })
  })
})

describe('calculatePlanMacros', () => {
  it('averages macros across days', () => {
    const days = [
      makeDay([makeMeal([makeItem({ kcal: 2000, protein_g: 100, carbs_g: 250, fat_g: 60 })])]),
      makeDay([makeMeal([makeItem({ kcal: 1800, protein_g: 90, carbs_g: 220, fat_g: 55 })])]),
    ]
    const result = calculatePlanMacros(days)
    expect(result.kcal).toBe(1900)
    expect(result.protein_g).toBe(95)
    expect(result.carbs_g).toBe(235)
    expect(result.fat_g).toBe(57.5)
  })

  it('returns zeros for empty plan', () => {
    expect(calculatePlanMacros([])).toEqual({
      kcal: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
    })
  })
})

describe('calculateSMAEEquivalents', () => {
  it('accumulates equivalents by group', () => {
    const items = [
      makeItem({ smae_group: 'cereales', smae_equivalents: 2 }),
      makeItem({ smae_group: 'cereales', smae_equivalents: 1 }),
      makeItem({ smae_group: 'frutas', smae_equivalents: 1.5 }),
      makeItem({ smae_group: 'proteinas_animales', smae_equivalents: 3 }),
    ]
    const result = calculateSMAEEquivalents(items)
    expect(result.cereales).toBe(3)
    expect(result.frutas).toBe(1.5)
    expect(result.proteinas_animales).toBe(3)
    expect(result.verduras).toBe(0)
    expect(result.leguminosas).toBe(0)
    expect(result.lacteos).toBe(0)
    expect(result.grasas).toBe(0)
    expect(result.azucares).toBe(0)
  })

  it('ignores items with unknown smae_group', () => {
    const items = [makeItem({ smae_group: 'invalid' as unknown as SMAEGroup, smae_equivalents: 5 })]
    const result = calculateSMAEEquivalents(items)
    expect(Object.values(result).every((v) => v === 0)).toBe(true)
  })
})

describe('calculateGroceryList', () => {
  const catalog = new Map([
    [
      'pollo',
      {
        food_id: 'pollo',
        food_name: 'Pechuga de pollo',
        smae_group: 'proteinas_animales' as SMAEGroup,
        purchase_unit: 'kg' as PurchaseUnit,
        g_per_piece: null,
        commercial_roundup: 500,
      },
    ],
    [
      'jitomate',
      {
        food_id: 'jitomate',
        food_name: 'Jitomate',
        smae_group: 'verduras' as SMAEGroup,
        purchase_unit: 'pieza' as PurchaseUnit,
        g_per_piece: 120,
        commercial_roundup: 1,
      },
    ],
    [
      'leche',
      {
        food_id: 'leche',
        food_name: 'Leche entera',
        smae_group: 'lacteos' as SMAEGroup,
        purchase_unit: 'litro' as PurchaseUnit,
        g_per_piece: null,
        commercial_roundup: 1000,
      },
    ],
    [
      'aceite',
      {
        food_id: 'aceite',
        food_name: 'Aceite de oliva',
        smae_group: 'grasas' as SMAEGroup,
        purchase_unit: 'ml' as PurchaseUnit,
        g_per_piece: null,
        commercial_roundup: 100,
      },
    ],
    [
      'avena',
      {
        food_id: 'avena',
        food_name: 'Avena en hojuelas',
        smae_group: 'cereales' as SMAEGroup,
        purchase_unit: 'g' as PurchaseUnit,
        g_per_piece: null,
        commercial_roundup: 500,
      },
    ],
  ])

  it('returns empty for empty plan', () => {
    expect(calculateGroceryList([], 7, catalog)).toEqual([])
  })

  it('consolidates duplicates into one line', () => {
    const day = makeDay([
      makeMeal([makeItem({ food_id: 'pollo', food_name: 'Pechuga', quantity_g: 150 })]),
      makeMeal([makeItem({ food_id: 'pollo', food_name: 'Pechuga', quantity_g: 200 })], {
        meal_type: 'comida',
      }),
    ])
    const list = calculateGroceryList([day], 1, catalog)
    expect(list).toHaveLength(1)
    expect(list[0]!.total_quantity_g).toBe(350)
  })

  it('cycles days when period > plan length', () => {
    const day = makeDay([makeMeal([makeItem({ food_id: 'pollo', quantity_g: 150 })])])
    const plan7 = calculateGroceryList([day], 7, catalog)
    expect(plan7[0]!.total_quantity_g).toBe(150 * 7)
  })

  it('applies commercial roundup for kg (pollo 750g → 1 kg)', () => {
    const day = makeDay([makeMeal([makeItem({ food_id: 'pollo', quantity_g: 750 })])])
    const list = calculateGroceryList([day], 1, catalog)
    expect(list[0]!.purchase_quantity).toBe(1)
    expect(list[0]!.display_quantity).toBe('1 kg')
  })

  it('shows kg below 1 as grams', () => {
    const day = makeDay([makeMeal([makeItem({ food_id: 'pollo', quantity_g: 200 })])])
    const list = calculateGroceryList([day], 1, catalog)
    expect(list[0]!.display_quantity).toBe('500 g')
  })

  it('converts pieza with g_per_piece (400g jitomate → 4 piezas)', () => {
    const day = makeDay([makeMeal([makeItem({ food_id: 'jitomate', quantity_g: 400 })])])
    const list = calculateGroceryList([day], 1, catalog)
    expect(list[0]!.purchase_quantity).toBe(4)
    expect(list[0]!.display_quantity).toBe('4 piezas')
  })

  it('uses singular for 1 pieza', () => {
    const day = makeDay([makeMeal([makeItem({ food_id: 'jitomate', quantity_g: 100 })])])
    const list = calculateGroceryList([day], 1, catalog)
    expect(list[0]!.display_quantity).toBe('1 pieza')
  })

  it('falls back to grams when pieza lacks g_per_piece', () => {
    const catalogNoGpp = new Map(catalog)
    catalogNoGpp.set('huevo', {
      food_id: 'huevo',
      food_name: 'Huevo',
      smae_group: 'proteinas_animales',
      purchase_unit: 'pieza',
      g_per_piece: null,
      commercial_roundup: 1,
    })
    const day = makeDay([makeMeal([makeItem({ food_id: 'huevo', quantity_g: 55.3 })])])
    const list = calculateGroceryList([day], 1, catalogNoGpp)
    expect(list[0]!.purchase_quantity).toBe(56)
  })

  it('handles litro unit (900g → 1 litro)', () => {
    const day = makeDay([makeMeal([makeItem({ food_id: 'leche', quantity_g: 900 })])])
    const list = calculateGroceryList([day], 1, catalog)
    expect(list[0]!.purchase_quantity).toBe(1)
    expect(list[0]!.display_quantity).toBe('1 litro')
  })

  it('handles litro under 1 as ml', () => {
    const catalogSmallMilk = new Map(catalog)
    catalogSmallMilk.set('leche', {
      food_id: 'leche',
      food_name: 'Leche entera',
      smae_group: 'lacteos',
      purchase_unit: 'litro',
      g_per_piece: null,
      commercial_roundup: 250,
    })
    const day = makeDay([makeMeal([makeItem({ food_id: 'leche', quantity_g: 200 })])])
    const list = calculateGroceryList([day], 1, catalogSmallMilk)
    expect(list[0]!.display_quantity).toBe('250 ml')
  })

  it('handles ml unit with roundup', () => {
    const day = makeDay([makeMeal([makeItem({ food_id: 'aceite', quantity_g: 30 })])])
    const list = calculateGroceryList([day], 1, catalog)
    expect(list[0]!.purchase_quantity).toBe(100)
    expect(list[0]!.display_quantity).toBe('100 ml')
  })

  it('handles g unit with roundup (display g under 1 kg)', () => {
    const day = makeDay([makeMeal([makeItem({ food_id: 'avena', quantity_g: 300 })])])
    const list = calculateGroceryList([day], 1, catalog)
    expect(list[0]!.purchase_quantity).toBe(500)
    expect(list[0]!.display_quantity).toBe('500 g')
  })

  it('handles g unit displayed as kg when >= 1000g', () => {
    const day = makeDay([makeMeal([makeItem({ food_id: 'avena', quantity_g: 1200 })])])
    const list = calculateGroceryList([day], 1, catalog)
    expect(list[0]!.display_quantity).toBe('1.5 kg')
  })

  it('skips items not in food catalog', () => {
    const day = makeDay([makeMeal([makeItem({ food_id: 'unknown', quantity_g: 100 })])])
    const list = calculateGroceryList([day], 1, catalog)
    expect(list).toHaveLength(0)
  })

  it('sorts by SMAE group category order', () => {
    const day = makeDay([
      makeMeal([
        makeItem({ food_id: 'avena', quantity_g: 100 }),
        makeItem({ food_id: 'pollo', quantity_g: 100 }),
        makeItem({ food_id: 'jitomate', quantity_g: 100 }),
      ]),
    ])
    const list = calculateGroceryList([day], 1, catalog)
    expect(list.map((i) => i.smae_group)).toEqual(['proteinas_animales', 'verduras', 'cereales'])
  })
})

describe('detectAllergens', () => {
  it('returns empty when no allergies listed', () => {
    const items = [makeItem({ food_name: 'Cacahuate' })]
    expect(detectAllergens(items, [])).toEqual([])
  })

  it('detects allergen by name substring (case-insensitive)', () => {
    const items = [
      makeItem({ food_id: 'f1', food_name: 'Cacahuate con sal' }),
      makeItem({ food_id: 'f2', food_name: 'Tortilla' }),
    ]
    const warnings = detectAllergens(items, ['Cacahuate'])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.food_id).toBe('f1')
    expect(warnings[0]!.allergen).toBe('cacahuate')
  })

  it('flags multiple allergens per item', () => {
    const items = [makeItem({ food_name: 'Leche con cacahuate' })]
    const warnings = detectAllergens(items, ['leche', 'cacahuate'])
    expect(warnings).toHaveLength(2)
  })
})

describe('adaptTemplateToPlan', () => {
  it('scales quantities so mean day kcal matches target', () => {
    const items = [makeItem({ kcal: 100, protein_g: 10, carbs_g: 20, fat_g: 5, quantity_g: 50 })]
    const day = makeDay([makeMeal(items)])
    const result = adaptTemplateToPlan([day], 200)
    expect(result.scaleFactor).toBe(2)
    expect(result.days[0]!.meals[0]!.items[0]!.kcal).toBe(200)
    expect(result.days[0]!.meals[0]!.items[0]!.quantity_g).toBe(100)
    expect(result.days[0]!.total_kcal).toBe(200)
  })

  it('returns empty result for empty template', () => {
    expect(adaptTemplateToPlan([], 1800)).toEqual({
      days: [],
      scaleFactor: 1,
      targetKcal: 1800,
      sourceKcal: 0,
    })
  })

  it('leaves scale at 1 when template kcal is zero', () => {
    const items = [makeItem({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })]
    const day = makeDay([makeMeal(items)])
    const result = adaptTemplateToPlan([day], 1800)
    expect(result.scaleFactor).toBe(1)
    expect(result.days[0]!.total_kcal).toBe(0)
  })

  it('averages source kcal across multiple days', () => {
    const d1 = makeDay([makeMeal([makeItem({ kcal: 800 })])], { id: 'd1' })
    const d2 = makeDay([makeMeal([makeItem({ kcal: 1200 })])], { id: 'd2' })
    const result = adaptTemplateToPlan([d1, d2], 1500)
    expect(result.sourceKcal).toBe(1000)
    expect(result.scaleFactor).toBe(1.5)
  })
})
