import { describe, it, expect } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from './zod.pipe'

const schema = z.object({ email: z.string().email(), age: z.number().int().min(1) })

describe('ZodValidationPipe', () => {
  it('returns parsed value on success', () => {
    const pipe = new ZodValidationPipe(schema)
    const result = pipe.transform({ email: 'a@b.com', age: 30 })
    expect(result).toEqual({ email: 'a@b.com', age: 30 })
  })

  it('throws BadRequestException with error details on failure', () => {
    const pipe = new ZodValidationPipe(schema)
    try {
      pipe.transform({ email: 'not-an-email', age: 0 })
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException)
      const body = (err as BadRequestException).getResponse() as {
        message: string
        errors: unknown
      }
      expect(body.message).toBe('Validation failed')
      expect(body.errors).toBeDefined()
    }
  })
})
