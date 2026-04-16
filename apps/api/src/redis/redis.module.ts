import { Global, Module, type DynamicModule } from '@nestjs/common'
import { REDIS_URL, RedisService } from './redis.service'

@Global()
@Module({})
export class RedisModule {
  static forRoot(url: string): DynamicModule {
    return {
      module: RedisModule,
      providers: [{ provide: REDIS_URL, useValue: url }, RedisService],
      exports: [RedisService],
    }
  }
}
