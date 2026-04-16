import { describe, it, expect } from 'vitest'
import { loadEnv } from './env'

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'a'.repeat(20),
  JWT_REFRESH_SECRET: 'b'.repeat(20),
}

describe('loadEnv', () => {
  it('applies defaults when optional vars are missing', () => {
    const env = loadEnv({ ...base } as NodeJS.ProcessEnv)
    expect(env.NODE_ENV).toBe('development')
    expect(env.PORT).toBe(3001)
    expect(env.JWT_ACCESS_TTL).toBe('15m')
    expect(env.JWT_REFRESH_TTL).toBe('7d')
  })

  it('coerces PORT from string', () => {
    const env = loadEnv({ ...base, PORT: '8080' } as NodeJS.ProcessEnv)
    expect(env.PORT).toBe(8080)
  })

  it('throws when a required var is missing', () => {
    const incomplete = { ...base } as Record<string, string>
    delete incomplete.JWT_SECRET
    expect(() => loadEnv(incomplete as NodeJS.ProcessEnv)).toThrow(/JWT_SECRET/)
  })

  it('throws when JWT secret is too short', () => {
    expect(() => loadEnv({ ...base, JWT_SECRET: 'short' } as NodeJS.ProcessEnv)).toThrow(
      /JWT_SECRET/,
    )
  })

  it('rejects invalid NODE_ENV', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'staging' } as NodeJS.ProcessEnv)).toThrow(/NODE_ENV/)
  })
})
