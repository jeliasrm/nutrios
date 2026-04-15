import type { ReactNode } from 'react'

export const metadata = {
  title: 'NutriOS',
  description: 'Sistema Multi-Tenant para Nutriólogos',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
