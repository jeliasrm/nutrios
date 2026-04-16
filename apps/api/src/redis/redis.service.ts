import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common'
import IORedis, { type Redis } from 'ioredis'

export const REDIS_URL = Symbol('REDIS_URL')

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis

  constructor(@Inject(REDIS_URL) url: string) {
    this.client = new IORedis(url, { lazyConnect: false, maxRetriesPerRequest: 3 })
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit()
  }

  get raw(): Redis {
    return this.client
  }

  async setWithTTL(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds)
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key)
  }

  async del(key: string): Promise<void> {
    await this.client.del(key)
  }
}
