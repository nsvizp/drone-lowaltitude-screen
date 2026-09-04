import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { ConfigModule } from './config/config.module'
import { LedgerModule } from './ledger/ledger.module'
import { OpenModule } from './open/open.module'
import { PrismaService } from './prisma.service'

@Module({
  imports: [AuthModule, ConfigModule, OpenModule, LedgerModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
