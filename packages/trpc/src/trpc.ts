import { initTRPC, TRPCError } from '@trpc/server'
import type { UserRole } from '@nutrios/types'
import type { Context } from './context'

const t = initTRPC.context<Context>().create()

export const router = t.router
export const middleware = t.middleware
export const publicProcedure = t.procedure

const requireAuth = middleware(({ ctx, next }) => {
  if (!ctx.user || !ctx.tenantId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' })
  }
  return next({
    ctx: { ...ctx, user: ctx.user, tenantId: ctx.tenantId },
  })
})

export const protectedProcedure = publicProcedure.use(requireAuth)

export function requireRoles(...allowed: UserRole[]) {
  return middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' })
    }
    if (!allowed.includes(ctx.user.role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Role "${ctx.user.role}" not permitted`,
      })
    }
    return next()
  })
}
