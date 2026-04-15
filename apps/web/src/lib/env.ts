export function getApiUrl(): string {
  const url = process.env['NEXT_PUBLIC_API_URL']
  if (!url) {
    return 'http://localhost:3001'
  }
  return url
}

export function getPlatformDomain(): string {
  return process.env['NEXT_PUBLIC_PLATFORM_DOMAIN'] ?? 'nutrios.mx'
}
