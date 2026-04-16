import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthService } from './auth.service'
import { PUBLIC_KEY } from './decorators'
import type { AuthUser, Role } from './auth.types'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>
      user?: AuthUser
    }>()

    const header = req.headers['authorization']
    const raw = Array.isArray(header) ? header[0] : header
    if (!raw || !raw.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token')
    }
    const token = raw.slice('Bearer '.length)
    const payload = this.auth.verifyAccessToken(token)

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, isActive: true },
    })
    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    req.user = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role as Role,
    }
    return true
  }
}
