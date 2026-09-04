import { Controller, Get, Post } from '@nestjs/common'
import { DisasterService } from './disaster.service'
import { EventLogService } from './event-log.service'

@Controller()
export class SimHostController {
  constructor(
    private readonly disaster: DisasterService,
    private readonly log: EventLogService,
  ) {}

  /** 触发洪灾模拟（前端「模拟洪灾」按钮） */
  @Post('disaster/simulate')
  simulate() {
    return this.disaster.simulateFlood()
  }

  /** 执行二次增援（前端「执行增援」按钮） */
  @Post('disaster/reinforce')
  reinforce() {
    return this.disaster.executeReinforcement()
  }

  /** 当前灾情状态快照（兜底拉取） */
  @Get('disaster/state')
  state() {
    return this.disaster.getState()
  }

  /** 事件流/节点最近历史（新页面加载时补齐） */
  @Get('events/recent')
  recent() {
    return this.log.recent()
  }
}
