import { Controller, Get, Query } from '@nestjs/common'
import { OpenService } from './open.service'
import type { Period } from './scale-task'

@Controller('open')
export class OpenController {
  constructor(private readonly svc: OpenService) {}

  @Get('total-data-by-dept')
  totalDataByDept() { return this.svc.totalDataByDept() }

  @Get('associated-fly-record')
  associatedFlyRecord(@Query('pageNum') pageNum?: string, @Query('pageSize') pageSize?: string) {
    return this.svc.associatedFlyRecord(Number(pageNum) || 1, Number(pageSize) || 10)
  }

  @Get('work-order-overview')
  workOrderOverview() { return this.svc.workOrderOverview() }

  @Get('task-overview')
  taskOverview(@Query('period') period?: Period) { return this.svc.taskOverview(period) }

  @Get('new-total-data-by-day')
  newTotalDataByDay() { return this.svc.newTotalDataByDay() }
}
