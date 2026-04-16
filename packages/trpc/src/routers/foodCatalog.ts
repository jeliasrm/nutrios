import { createFoodSchema, foodSearchSchema } from '@nutrios/validations'
import { router, protectedProcedure, requireRoles } from '../trpc'

export const foodCatalogRouter = router({
  search: protectedProcedure.input(foodSearchSchema).query(async ({ ctx, input }) => {
    return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
      return tx.foodCatalog.findMany({
        where: {
          OR: [
            { name: { contains: input.q, mode: 'insensitive' } },
            { aliases: { has: input.q.toLowerCase() } },
          ],
        },
        take: input.limit,
        orderBy: [{ isVerified: 'desc' }, { name: 'asc' }],
      })
    })
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
      return tx.foodCatalog.findMany({
        take: 200,
        orderBy: { name: 'asc' },
      })
    })
  }),

  create: protectedProcedure
    .use(requireRoles('admin', 'nutriologo'))
    .input(createFoodSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.withTenant(ctx.tenantId, async (tx) => {
        return tx.foodCatalog.create({
          data: {
            tenantId: ctx.tenantId,
            name: input.name,
            brand: input.brand,
            kcalPer100g: input.kcal_per_100g,
            proteinG: input.protein_g,
            carbsG: input.carbs_g,
            fatG: input.fat_g,
            fiberG: input.fiber_g,
            smaeGroup: input.smae_group,
            smaeEquivPerPortion: input.smae_equiv_per_portion,
            portionSizeG: input.portion_size_g,
            portionLabel: input.portion_label,
            purchaseUnit: input.purchase_unit,
            gPerPiece: input.g_per_piece ?? null,
            commercialRoundup: input.commercial_roundup,
            aliases: input.aliases,
            isVerified: false,
            isPublic: false,
          },
        })
      })
    }),
})
