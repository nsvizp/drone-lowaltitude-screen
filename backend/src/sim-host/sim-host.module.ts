import { Module } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { DisasterService } from './disaster.service'
import { EventBus } from './event-bus'
import { EventLogService } from './event-log.service'
import { EventsGateway } from './events.gateway'
import { FleetService } from './fleet.service'
import { SimHostController } from './sim-host.controller'

@Module({
  controllers: [SimHostController],
  providers: [EventBus, EventLogService, FleetService, DisasterService, EventsGateway, PrismaService],
})
export class SimHostModule {}
