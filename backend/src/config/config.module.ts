import { Module } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { ConfigController } from './config.controller'
import { ConfigService } from './config.service'

@Module({
  controllers: [ConfigController],
  providers: [ConfigService, PrismaService],
  exports: [ConfigService],
})
export class ConfigModule {}
