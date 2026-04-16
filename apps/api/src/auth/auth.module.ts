import { Module, type DynamicModule } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { AuthController } from './auth.controller'
import { AuthService, AUTH_CONFIG, type AuthConfig } from './auth.service'
import { JwtAuthGuard } from './jwt.guard'
import { RolesGuard } from './roles.guard'

@Module({})
export class AuthModule {
  static forRoot(config: AuthConfig): DynamicModule {
    return {
      module: AuthModule,
      controllers: [AuthController],
      providers: [
        { provide: AUTH_CONFIG, useValue: config },
        AuthService,
        JwtAuthGuard,
        RolesGuard,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
      exports: [AuthService],
    }
  }
}
