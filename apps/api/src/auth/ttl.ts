export function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl)
  if (!match) throw new Error(`Invalid TTL: ${ttl}`)
  const [, nStr, unit] = match
  const n = Number(nStr)
  switch (unit) {
    case 's':
      return n
    case 'm':
      return n * 60
    case 'h':
      return n * 60 * 60
    case 'd':
      return n * 60 * 60 * 24
    default:
      throw new Error(`Invalid TTL unit: ${unit}`)
  }
}
