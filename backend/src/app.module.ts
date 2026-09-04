import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { AuthGuard } from './auth/auth.guard'
import { AuthModule } from './auth/auth.module'
import { ConfigModule } from './config/config.module'
import { LedgerModule } from './ledger/ledger.module'
import { OpenModule } from './open/open.module'
import { SimHostModule } from './sim-host/sim-host.module'
import { PrismaService } from './prisma.service'

@Module({
  imports: [AuthModule, ConfigModule, OpenModule, LedgerModule, SimHostModule],
  providers: [PrismaService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [PrismaService],
})
export class AppModule {}
