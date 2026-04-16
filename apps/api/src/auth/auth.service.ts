import { randomUUID } from 'node:crypto'
import { ConflictException, Injectable, UnauthorizedException, Inject } from '@nestjs/common'
import bcrypt from 'bcryptjs'
import jwt, { type SignOptions } from 'jsonwebtoken'
import type { LoginInput, RegisterTenantInput, RefreshTokenInput } from '@nutrios/validations'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import { ttlToSeconds } from './ttl'
import type {
  AccessTokenPayload,
  AuthTokens,
  AuthUser,
  RefreshTokenPayload,
  Role,
} from './auth.types'

export const AUTH_CONFIG = Symbol('AUTH_CONFIG')

export interface AuthConfig {
  jwtSecret: string
  jwtRefreshSecret: string
  accessTtl: string
  refreshTtl: string
}

const BCRYPT_ROUNDS = 10

function refreshKey(userId: string, jti: string): string {
  return `refresh:${userId}:${jti}`
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  async registerTenant(
    input: RegisterTenantInput,
  ): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const existing = await this.prisma.tenant.findUnique({
      where: { subdomain: input.subdomain },
    })
    if (existing) {
      throw new ConflictException('Subdomain already taken')
    }

    const passwordHash = await bcrypt.hash(input.adminPassword, BCRYPT_ROUNDS)

    const { tenant, user } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: input.tenantName,
          subdomain: input.subdomain,
          plan: 'free',
          status: 'active',
        },
      })
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: input.adminEmail.toLowerCase(),
          name: input.adminName,
          role: 'admin',
          password: passwordHash,
        },
      })
      return { tenant, user }
    })

    const authUser: AuthUser = {
      id: user.id,
      tenantId: tenant.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
    }
    const tokens = await this.issueTokens(authUser)
    return { user: authUser, tokens }
  }

  async login(input: LoginInput): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const user = await this.prisma.user.findFirst({
      where: { email: input.email.toLowerCase(), isActive: true },
    })
    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }
    const matches = await bcrypt.compare(input.password, user.password)
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials')
    }
    const authUser: AuthUser = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role as Role,
    }
    const tokens = await this.issueTokens(authUser)
    return { user: authUser, tokens }
  }

  async refresh(input: RefreshTokenInput): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    let payload: RefreshTokenPayload
    try {
      payload = jwt.verify(input.refreshToken, this.config.jwtRefreshSecret) as RefreshTokenPayload
    } catch {
      throw new UnauthorizedException('Invalid refresh token')
    }

    const stored = await this.redis.get(refreshKey(payload.sub, payload.jti))
    if (!stored) {
      throw new UnauthorizedException('Refresh token revoked')
    }

    await this.redis.del(refreshKey(payload.sub, payload.jti))

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, isActive: true },
    })
    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    const authUser: AuthUser = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role as Role,
    }
    const tokens = await this.issueTokens(authUser)
    return { user: authUser, tokens }
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = jwt.verify(refreshToken, this.config.jwtRefreshSecret) as RefreshTokenPayload
      await this.redis.del(refreshKey(payload.sub, payload.jti))
    } catch {
      // Silent: invalid token is already effectively logged out
    }
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      return jwt.verify(token, this.config.jwtSecret) as AccessTokenPayload
    } catch {
      throw new UnauthorizedException('Invalid access token')
    }
  }

  private async issueTokens(user: AuthUser): Promise<AuthTokens> {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
    }
    const jti = randomUUID()
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      jti,
    }

    const accessOpts: SignOptions = { expiresIn: this.config.accessTtl as SignOptions['expiresIn'] }
    const refreshOpts: SignOptions = {
      expiresIn: this.config.refreshTtl as SignOptions['expiresIn'],
    }

    const accessToken = jwt.sign(accessPayload, this.config.jwtSecret, accessOpts)
    const refreshToken = jwt.sign(refreshPayload, this.config.jwtRefreshSecret, refreshOpts)

    const refreshSeconds = ttlToSeconds(this.config.refreshTtl)
    await this.redis.setWithTTL(
      refreshKey(user.id, jti),
      JSON.stringify({ createdAt: new Date().toISOString() }),
      refreshSeconds,
    )

    const accessSeconds = ttlToSeconds(this.config.accessTtl)
    const accessExpiresAt = new Date(Date.now() + accessSeconds * 1000).toISOString()

    return { accessToken, refreshToken, accessExpiresAt }
  }
}
