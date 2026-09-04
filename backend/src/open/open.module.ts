import { Module } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { OpenController } from './open.controller'
import { OpenService } from './open.service'

@Module({
  controllers: [OpenController],
  providers: [OpenService, PrismaService],
})
export class OpenModule {}
