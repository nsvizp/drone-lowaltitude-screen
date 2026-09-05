import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { AppModule } from './app.module'
import { ALLOWED_ORIGINS } from './sim-host/events.gateway'

async function bootstrap() {
  // 本地密钥只放在 backend/.env.local；生产环境仍由部署平台注入环境变量。
  const localEnvPath = resolve(__dirname, '../.env.local')
  if (existsSync(localEnvPath)) loadEnvFile(localEnvPath)
  const app = await NestFactory.create(AppModule, { cors: { origin: ALLOWED_ORIGINS } })
  app.setGlobalPrefix('api')
  const port = Number(process.env.PORT ?? 3000)
  await app.listen(port)
  console.log('[backend] listening on http://127.0.0.1:' + port + '/api')
}
void bootstrap()
