import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors()

  const port = process.env['PORT'] ?? 3001
  await app.listen(port)
}

bootstrap().catch((err: unknown) => {
  process.stderr.write(`Failed to start NutriOS API: ${String(err)}\n`)
  process.exit(1)
})
