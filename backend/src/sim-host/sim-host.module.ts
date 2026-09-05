import { Module } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { DisasterService } from './disaster.service'
import { EventBus } from './event-bus'
import { EventLogService } from './event-log.service'
import { EventsGateway } from './events.gateway'
import { FleetService } from './fleet.service'
import { SimHostController } from './sim-host.controller'
import { AiDecisionService } from './ai-decision.service'

@Module({
  controllers: [SimHostController],
  providers: [EventBus, EventLogService, FleetService, AiDecisionService, DisasterService, EventsGateway, PrismaService],
})
export class SimHostModule {}
