import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { ConfigModule } from './config/config.module'
import { PrismaService } from './prisma.service'

@Module({
  imports: [AuthModule, ConfigModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
