import { Body, Controller, Get, Post } from '@nestjs/common'
import { DisasterService } from './disaster.service'
import { EventLogService } from './event-log.service'

@Controller()
export class SimHostController {
  constructor(
    private readonly disaster: DisasterService,
    private readonly log: EventLogService,
  ) {}

  /** 触发灾情模拟；forceRuleFallback 仅用于演示规则算法兜底。 */
  @Post('disaster/simulate')
  simulate(@Body() body: { type?: 'flood' | 'debris' | 'fire'; forceRuleFallback?: boolean }) {
    const type = body?.type
    return this.disaster.simulateFlood(
      type === 'debris' ? 'debris' : type === 'fire' ? 'fire' : 'flood',
      body?.forceRuleFallback === true,
    )
  }

  /** 指挥确认后执行规则引擎生成的待调配方案。 */
  @Post('disaster/execute')
  execute() {
    return this.disaster.executeDispatch()
  }

  /** 执行二次增援（前端「执行增援」按钮） */
  @Post('disaster/reinforce')
  reinforce() {
    return this.disaster.executeReinforcement()
  }

  /** 结束演练（清空在演灾情） */
  @Post('disaster/resolve')
  resolve() {
    return this.disaster.resolveDisaster()
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
