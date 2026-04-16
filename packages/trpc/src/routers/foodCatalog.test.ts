import { describe, it, expect, vi } from 'vitest'
import { foodCatalogRouter } from './foodCatalog'
import { createFakeContext, defaultUser } from '../test-utils'

describe('foodCatalogRouter', () => {
  it('search queries name contains + aliases.has (lowercased)', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const tx = { foodCatalog: { findMany } }
    const caller = foodCatalogRouter.createCaller(createFakeContext({ tx }))

    await caller.search({ q: 'Pollo', limit: 20 })

    const args = findMany.mock.calls[0]?.[0] as {
      where: { OR: [{ name: { contains: string } }, { aliases: { has: string } }] }
      take: number
      orderBy: Array<Record<string, string>>
    }
    expect(args.where.OR[0].name.contains).toBe('Pollo')
    expect(args.where.OR[1].aliases.has).toBe('pollo')
    expect(args.take).toBe(20)
    expect(args.orderBy[0]).toEqual({ isVerified: 'desc' })
  })

  it('list uses take=200 and ordered by name', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const caller = foodCatalogRouter.createCaller(
      createFakeContext({ tx: { foodCatalog: { findMany } } }),
    )
    await caller.list()
    expect(findMany).toHaveBeenCalledWith({ take: 200, orderBy: { name: 'asc' } })
  })

  it('create rejected for paciente role', async () => {
    const caller = foodCatalogRouter.createCaller(
      createFakeContext({ user: defaultUser('paciente') }),
    )
    await expect(
      caller.create({
        name: 'Tortilla',
        kcal_per_100g: 218,
        protein_g: 5.7,
        carbs_g: 45.9,
        fat_g: 2.5,
        fiber_g: 3.9,
        smae_group: 'cereales',
        smae_equiv_per_portion: 1,
        portion_size_g: 30,
        portion_label: '1 tortilla',
        purchase_unit: 'pieza',
        g_per_piece: 30,
        commercial_roundup: 10,
        aliases: ['tortilla'],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('create persists tenant-scoped food with isVerified=false', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'f1' })
    const caller = foodCatalogRouter.createCaller(
      createFakeContext({ tx: { foodCatalog: { create } } }),
    )
    await caller.create({
      name: 'Tortilla',
      kcal_per_100g: 218,
      protein_g: 5.7,
      carbs_g: 45.9,
      fat_g: 2.5,
      fiber_g: 3.9,
      smae_group: 'cereales',
      smae_equiv_per_portion: 1,
      portion_size_g: 30,
      portion_label: '1 tortilla',
      purchase_unit: 'pieza',
      g_per_piece: 30,
      commercial_roundup: 10,
      aliases: ['tortilla'],
    })
    const data = (
      create.mock.calls[0]?.[0] as {
        data: { tenantId: string; isVerified: boolean; isPublic: boolean }
      }
    ).data
    expect(data.tenantId).toBe('tenant-a')
    expect(data.isVerified).toBe(false)
    expect(data.isPublic).toBe(false)
  })
})
