import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from './decorators'
import type { AuthUser, Role } from './auth.types'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required || required.length === 0) return true

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>()
    const user = req.user
    if (!user) {
      throw new ForbiddenException('No user in request')
    }
    if (!required.includes(user.role)) {
      throw new ForbiddenException(`Requires role: ${required.join('|')}`)
    }
    return true
  }
}
