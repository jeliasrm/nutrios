import { describe, it, expect, vi } from 'vitest'
import { consultationsRouter, anthropometricsRouter } from './consultations'
import { createFakeContext, defaultUser } from '../test-utils'

describe('consultationsRouter', () => {
  it('listByPatient queries by patientId desc', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const tx = { consultation: { findMany } }
    const caller = consultationsRouter.createCaller(createFakeContext({ tx }))
    await caller.listByPatient('11111111-1111-1111-1111-111111111111')
    expect(findMany).toHaveBeenCalledWith({
      where: { patientId: '11111111-1111-1111-1111-111111111111' },
      orderBy: { date: 'desc' },
      include: { anthropometrics: true, nutritionalDiagnosis: true },
    })
  })

  it('getById throws NOT_FOUND', async () => {
    const tx = { consultation: { findUnique: vi.fn().mockResolvedValue(null) } }
    const caller = consultationsRouter.createCaller(createFakeContext({ tx }))
    await expect(caller.getById('11111111-1111-1111-1111-111111111111')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('create sets nutritionistId from ctx.user', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'c1' })
    const tx = { consultation: { create } }
    const caller = consultationsRouter.createCaller(createFakeContext({ tx }))
    await caller.create({
      patient_id: '11111111-1111-1111-1111-111111111111',
      date: '2026-04-15T09:00:00.000Z',
      reason: 'Control',
    })
    const data = (create.mock.calls[0]?.[0] as { data: { nutritionistId: string } }).data
    expect(data.nutritionistId).toBe('user-1')
  })

  it('create rejected for paciente', async () => {
    const caller = consultationsRouter.createCaller(
      createFakeContext({ user: defaultUser('paciente') }),
    )
    await expect(
      caller.create({
        patient_id: '11111111-1111-1111-1111-111111111111',
        date: '2026-04-15',
        reason: 'Control',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('anonymous context rejected', async () => {
    const caller = consultationsRouter.createCaller(
      createFakeContext({ user: null, tenantId: null }),
    )
    await expect(
      caller.listByPatient('11111111-1111-1111-1111-111111111111'),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

describe('anthropometricsRouter', () => {
  it('create computes BMI correctly', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'a1' })
    const tx = { anthropometric: { create } }
    const caller = anthropometricsRouter.createCaller(createFakeContext({ tx }))
    await caller.create({
      consultation_id: '11111111-1111-1111-1111-111111111111',
      weight_kg: 70,
      height_cm: 170,
    })
    const data = (create.mock.calls[0]?.[0] as { data: { bmi: number } }).data
    expect(data.bmi).toBeCloseTo(24.2, 0)
  })

  it('listByConsultation orders by createdAt desc', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const tx = { anthropometric: { findMany } }
    const caller = anthropometricsRouter.createCaller(createFakeContext({ tx }))
    await caller.listByConsultation('11111111-1111-1111-1111-111111111111')
    expect(findMany).toHaveBeenCalledWith({
      where: { consultationId: '11111111-1111-1111-1111-111111111111' },
      orderBy: { createdAt: 'desc' },
    })
  })
})
