# NutriOS

Sistema Multi-Tenant para Nutriólogos en México.

## Tech Stack

- **Frontend Web:** Next.js 15 + App Router + shadcn/ui + Tailwind CSS v4
- **Mobile:** Expo SDK 52 + React Native
- **Backend API:** NestJS 11 + tRPC v11
- **Base de datos:** PostgreSQL 17 + Prisma 6
- **Cache/Queues:** Redis 7 + BullMQ
- **Auth:** Better Auth v1

## Monorepo Structure

```
nutrios/
├── apps/
│   ├── web/       # Next.js 15 — dashboard nutriólogo
│   ├── mobile/    # Expo 52 — app paciente
│   └── api/       # NestJS 11 — REST + tRPC
├── packages/
│   ├── db/            # Prisma schema + migrations
│   ├── ui/            # shadcn components compartidos
│   ├── trpc/          # Router definitions
│   ├── validations/   # Zod schemas
│   ├── types/         # TypeScript types
│   ├── diet-engine/   # Lógica pura: SMAE, macros, despensa
│   └── config/        # ESLint, Tailwind, TS configs
└── turbo.json
```

## Getting Started

```bash
pnpm install
pnpm dev
```

## Testing

```bash
pnpm test
pnpm test:coverage
```

## License

MIT
