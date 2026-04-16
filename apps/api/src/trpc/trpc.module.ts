import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { RedisModule } from '../redis/redis.module'
import { TrpcMiddleware } from './trpc.middleware'

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [TrpcMiddleware],
  exports: [TrpcMiddleware],
})
export class TrpcModule {}
