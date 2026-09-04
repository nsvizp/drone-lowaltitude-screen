import { Controller, Get, Module } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

@Controller()
class LedgerController {
  constructor(private readonly prisma: PrismaService) {}

  /** 仓储台账（物资仓储情况面板数据源） */
  @Get('warehouses')
  async warehouses() {
    const rows = await this.prisma.warehouse.findMany({ orderBy: { id: 'asc' } })
    return rows.map((w) => ({ ...w, percent: Math.round((w.stock / w.capacity) * 100) }))
  }

  @Get('shelters')
  shelters() { return this.prisma.shelter.findMany({ orderBy: { id: 'asc' } }) }

  @Get('flyers')
  flyers() { return this.prisma.flyer.findMany({ orderBy: { id: 'asc' } }) }
}

@Module({ controllers: [LedgerController], providers: [PrismaService] })
export class LedgerModule {}
