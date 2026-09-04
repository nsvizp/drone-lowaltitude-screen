import { OnModuleInit } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import type { Server, Socket } from 'socket.io'
import { DisasterService } from './disaster.service'
import { EventBus } from './event-bus'
import { EventLogService } from './event-log.service'
import { FleetService } from './fleet.service'

/** 允许的前端来源（HTTP 与 WS 共用；逗号分隔环境变量可覆盖） */
export const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',')

/** WebSocket 网关：fleet 每秒快照 + feed/node/disaster 变更推送；握手要求有效 JWT */
@WebSocketGateway({ cors: { origin: ALLOWED_ORIGINS } })
export class EventsGateway implements OnModuleInit {
  @WebSocketServer()
  server!: Server

  constructor(
    private readonly fleet: FleetService,
    private readonly disaster: DisasterService,
    private readonly log: EventLogService,
    private readonly bus: EventBus,
    private readonly jwt: JwtService,
  ) {}

  /** 握手鉴权：auth.token 无效 → 立即断开 */
  private async authorize(socket: Socket): Promise<boolean> {
    const token = (socket.handshake.auth as Record<string, unknown> | undefined)?.token
    if (typeof token !== 'string' || !token) { socket.disconnect(true); return false }
    try {
      await this.jwt.verifyAsync(token)
      return true
    } catch {
      socket.disconnect(true)
      return false
    }
  }

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
    this.bus.on('warehouses', (w) => this.server.emit('warehouses', w))

    // 新客户端连入：先鉴权，再补发当前状态与历史
    this.server.on('connection', (socket) => {
      void this.authorize(socket).then((ok) => {
        if (!ok) return
        socket.emit('fleet', this.fleet.getSnapshot())
        socket.emit('disaster', this.disaster.getState())
        socket.emit('history', this.log.recent())
      })
    })
  }
}
