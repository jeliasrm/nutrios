import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Role, AuthUser } from './auth.types'

export const ROLES_KEY = 'roles'
export const PUBLIC_KEY = 'isPublic'

export const Roles = (...roles: Role[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles)

export const Public = (): ReturnType<typeof SetMetadata> => SetMetadata(PUBLIC_KEY, true)

export const CurrentUser = createParamDecorator((_, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>()
  if (!req.user) {
    throw new Error('CurrentUser used on unauthenticated route')
  }
  return req.user
})
