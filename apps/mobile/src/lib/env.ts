export function getApiBaseUrl(): string {
  const url = process.env['EXPO_PUBLIC_API_URL']
  if (!url) {
    return 'http://localhost:3001'
  }
  return url
}

export function formatGreeting(hour: number): string {
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}
