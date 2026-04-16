import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common'
import { HealthModule } from './health/health.module'
import { PrismaModule } from './prisma/prisma.module'
import { RedisModule } from './redis/redis.module'
import { AuthModule } from './auth/auth.module'
import { TenantMiddleware } from './common/tenant.middleware'
import { loadEnv } from './config/env'

const env = loadEnv()

@Module({
  imports: [
    PrismaModule,
    RedisModule.forRoot(env.REDIS_URL),
    AuthModule.forRoot({
      jwtSecret: env.JWT_SECRET,
      jwtRefreshSecret: env.JWT_REFRESH_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtl: env.JWT_REFRESH_TTL,
    }),
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes('*')
  }
}
