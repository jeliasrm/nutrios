import { describe, it, expect } from 'vitest'
import { Roles, Public, ROLES_KEY, PUBLIC_KEY } from './decorators'

describe('auth decorators', () => {
  it('Roles() attaches the role list as metadata', () => {
    class Target {}
    const decorator = Roles('admin', 'nutriologo')
    decorator(Target)
    const meta = Reflect.getMetadata(ROLES_KEY, Target) as string[]
    expect(meta).toEqual(['admin', 'nutriologo'])
  })

  it('Public() attaches true as metadata', () => {
    class Target {}
    const decorator = Public()
    decorator(Target)
    expect(Reflect.getMetadata(PUBLIC_KEY, Target)).toBe(true)
  })
})
