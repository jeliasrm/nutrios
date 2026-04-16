import { router } from './trpc'
import { patientsRouter } from './routers/patients'
import { consultationsRouter, anthropometricsRouter } from './routers/consultations'
import { foodCatalogRouter } from './routers/foodCatalog'
import { dietPlansRouter } from './routers/dietPlans'
import { dietPlanBuilderRouter } from './routers/dietPlanBuilder'
import { dietPlanTemplatesRouter } from './routers/dietPlanTemplates'
import { dietPlanWizardRouter } from './routers/dietPlanWizard'
import { groceryListRouter } from './routers/groceryList'

export const appRouter = router({
  patients: patientsRouter,
  consultations: consultationsRouter,
  anthropometrics: anthropometricsRouter,
  foodCatalog: foodCatalogRouter,
  dietPlans: dietPlansRouter,
  dietPlanBuilder: dietPlanBuilderRouter,
  dietPlanTemplates: dietPlanTemplatesRouter,
  dietPlanWizard: dietPlanWizardRouter,
  groceryList: groceryListRouter,
})

export type AppRouter = typeof appRouter

export type { Context, AuthUser, PrismaLike, RedisLike, TxClient } from './context'
export { router, publicProcedure, protectedProcedure, middleware, requireRoles } from './trpc'
