import { describe, it, expect, vi } from 'vitest'
import { PrismaService } from './prisma.service'

describe('PrismaService', () => {
  it('onModuleInit connects the client', async () => {
    const svc = new PrismaService()
    const connect = vi.spyOn(svc, '$connect').mockResolvedValue(undefined)
    await svc.onModuleInit()
    expect(connect).toHaveBeenCalled()
  })

  it('onModuleDestroy disconnects the client', async () => {
    const svc = new PrismaService()
    const disconnect = vi.spyOn(svc, '$disconnect').mockResolvedValue(undefined)
    await svc.onModuleDestroy()
    expect(disconnect).toHaveBeenCalled()
  })

  it('withTenant wraps the callback in a transaction and sets tenant first', async () => {
    const svc = new PrismaService()
    const executeRaw = vi.fn().mockResolvedValue(1)
    const tx = { $executeRaw: executeRaw }
    const txSpy = vi
      .spyOn(svc, '$transaction')
      .mockImplementation(async (fn: unknown) => (fn as (tx: unknown) => Promise<unknown>)(tx))

    const result = await svc.withTenant('aa0f85e4-0cb9-4848-ba75-3c08c7e6eda7', async () => 'ok')
    expect(result).toBe('ok')
    expect(executeRaw).toHaveBeenCalledOnce()
    expect(txSpy).toHaveBeenCalledOnce()
  })
})
