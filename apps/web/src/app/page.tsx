import { UI_VERSION } from '@nutrios/ui'

export default function HomePage() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: '2rem' }}>
      <h1>NutriOS</h1>
      <p>Sistema Multi-Tenant para Nutriólogos — v0.1.0</p>
      <p>UI package: v{UI_VERSION}</p>
    </main>
  )
}
