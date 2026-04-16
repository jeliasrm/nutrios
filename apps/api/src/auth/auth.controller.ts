import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import {
  loginSchema,
  refreshTokenSchema,
  registerTenantSchema,
  type LoginInput,
  type RefreshTokenInput,
  type RegisterTenantInput,
} from '@nutrios/validations'
import { AuthService } from './auth.service'
import { Public } from './decorators'
import { ZodValidationPipe } from './zod.pipe'
import type { AuthTokens, AuthUser } from './auth.types'

interface AuthResponse {
  user: AuthUser
  tokens: AuthTokens
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register-tenant')
  @HttpCode(201)
  registerTenant(
    @Body(new ZodValidationPipe(registerTenantSchema)) body: RegisterTenantInput,
  ): Promise<AuthResponse> {
    return this.auth.registerTenant(body)
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<AuthResponse> {
    return this.auth.login(body)
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(
    @Body(new ZodValidationPipe(refreshTokenSchema)) body: RefreshTokenInput,
  ): Promise<AuthResponse> {
    return this.auth.refresh(body)
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Body(new ZodValidationPipe(refreshTokenSchema)) body: RefreshTokenInput,
  ): Promise<void> {
    await this.auth.logout(body.refreshToken)
  }
}
