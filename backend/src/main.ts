import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true })
  app.setGlobalPrefix('api')
  const port = Number(process.env.PORT ?? 3000)
  await app.listen(port)
  console.log('[backend] listening on http://127.0.0.1:' + port + '/api')
}
void bootstrap()
