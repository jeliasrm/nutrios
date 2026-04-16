import { describe, it, expect, vi, afterEach } from 'vitest'
import IORedis from 'ioredis'
import { RedisService } from './redis.service'

vi.mock('ioredis', () => {
  const instance = {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue('value'),
    del: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
  }
  const Ctor = vi.fn(() => instance)
  return { default: Ctor, __instance: instance }
})

function getMockInstance(): {
  set: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  del: ReturnType<typeof vi.fn>
  quit: ReturnType<typeof vi.fn>
} {
  const module = IORedis as unknown as { __instance: never }
  const instance = (module as unknown as Record<string, unknown>).__instance as {
    set: ReturnType<typeof vi.fn>
    get: ReturnType<typeof vi.fn>
    del: ReturnType<typeof vi.fn>
    quit: ReturnType<typeof vi.fn>
  }
  if (instance) return instance
  // Fallback: IORedis() returns the shared instance in our mock.
  const Ctor = IORedis as unknown as new (url: string) => typeof instance
  return new Ctor('redis://localhost')
}

describe('RedisService', () => {
  afterEach(() => vi.clearAllMocks())

  it('setWithTTL calls underlying SET with EX', async () => {
    const svc = new RedisService('redis://localhost')
    await svc.setWithTTL('k', 'v', 30)
    const inst = getMockInstance()
    expect(inst.set).toHaveBeenCalledWith('k', 'v', 'EX', 30)
  })

  it('get passes through to the client', async () => {
    const svc = new RedisService('redis://localhost')
    const result = await svc.get('k')
    expect(result).toBe('value')
  })

  it('del passes through to the client', async () => {
    const svc = new RedisService('redis://localhost')
    await svc.del('k')
    const inst = getMockInstance()
    expect(inst.del).toHaveBeenCalledWith('k')
  })

  it('onModuleDestroy quits the client', async () => {
    const svc = new RedisService('redis://localhost')
    await svc.onModuleDestroy()
    const inst = getMockInstance()
    expect(inst.quit).toHaveBeenCalled()
  })

  it('exposes the raw client via getter', () => {
    const svc = new RedisService('redis://localhost')
    expect(svc.raw).toBeDefined()
  })
})
