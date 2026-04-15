import { describe, it, expect, expectTypeOf } from 'vitest'
import type {
  UserRole,
  MealType,
  SMAEGroup,
  PurchaseUnit,
  GroceryPeriod,
  Macros,
  DietDay,
} from './index'

describe('Types — shape and literal guards', () => {
  it('UserRole accepts expected literals', () => {
    const roles: UserRole[] = ['superadmin', 'admin', 'nutriologo', 'recepcionista', 'paciente']
    expect(roles).toHaveLength(5)
  })

  it('MealType accepts the 6 meal slots', () => {
    const meals: MealType[] = ['desayuno', 'colacion_am', 'comida', 'colacion_pm', 'cena', 'extra']
    expect(meals).toHaveLength(6)
  })

  it('SMAEGroup covers the 8 canonical groups', () => {
    const groups: SMAEGroup[] = [
      'cereales',
      'leguminosas',
      'verduras',
      'frutas',
      'lacteos',
      'proteinas_animales',
      'grasas',
      'azucares',
    ]
    expect(groups).toHaveLength(8)
  })

  it('PurchaseUnit covers grocery units', () => {
    const units: PurchaseUnit[] = ['g', 'kg', 'pieza', 'litro', 'ml']
    expect(units).toHaveLength(5)
  })

  it('GroceryPeriod is 1 | 3 | 5 | 7', () => {
    const periods: GroceryPeriod[] = [1, 3, 5, 7]
    expect(periods).toHaveLength(4)
  })

  it('Macros carries kcal and macros and optional fiber_g', () => {
    const m: Macros = { kcal: 100, protein_g: 10, carbs_g: 20, fat_g: 5 }
    expect(m.kcal).toBe(100)
    expectTypeOf<Macros>().toHaveProperty('fiber_g')
  })

  it('DietDay nests meals', () => {
    const d: DietDay = {
      id: 'x',
      day_label: 'Lun',
      position: 0,
      meals: [],
      total_kcal: 0,
      macros: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    }
    expect(Array.isArray(d.meals)).toBe(true)
  })
})
