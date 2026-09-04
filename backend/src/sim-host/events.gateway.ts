import { OnModuleInit } from '@nestjs/common'
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import type { Server } from 'socket.io'
import { DisasterService } from './disaster.service'
import { EventBus } from './event-bus'
import { EventLogService } from './event-log.service'
import { FleetService } from './fleet.service'

/** WebSocket 网关：fleet 每秒快照 + feed/node/disaster 变更推送 */
@WebSocketGateway({ cors: true })
export class EventsGateway implements OnModuleInit {
  @WebSocketServer()
  server!: Server

  constructor(
    private readonly fleet: FleetService,
    private readonly disaster: DisasterService,
    private readonly log: EventLogService,
    private readonly bus: EventBus,
  ) {}

  onModuleInit(): void {
    // 机队快照：每 tick 广播（前端订阅驱动地图/面板）
    this.fleet.onTick((f) => {
      this.server.emit('fleet', f)
      this.disaster.broadcastIfChanged()
    })
    // 事件流/节点：产生即推
    this.bus.on('feed', (e) => this.server.emit('feed', e))
    this.bus.on('node', (n) => this.server.emit('node', n))
    this.bus.on('disaster', (d) => this.server.emit('disaster', d))

    // 新客户端连入：补发当前状态与历史
    this.server.on('connection', (socket) => {
      socket.emit('fleet', this.fleet.getSnapshot())
      socket.emit('disaster', this.disaster.getState())
      socket.emit('history', this.log.recent())
    })
  }
}
