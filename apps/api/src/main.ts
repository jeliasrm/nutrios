import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { loadEnv } from './config/env'

async function bootstrap(): Promise<void> {
  const env = loadEnv()
  const app = await NestFactory.create(AppModule)
  app.enableCors()
  await app.listen(env.PORT)
}

bootstrap().catch((err: unknown) => {
  process.stderr.write(`Failed to start NutriOS API: ${String(err)}\n`)
  process.exit(1)
})
