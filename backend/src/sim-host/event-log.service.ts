import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { EventBus } from './event-bus'

export interface FeedEntry { kind: string; text: string; time: string }
export interface NodeEntry { title: string; detail: string; time: string }

const FEED_KEEP = 50
const NODE_KEEP = 30

/** 事件流/节点记录：写库 + 内存环形缓冲 + 总线广播 */
@Injectable()
export class EventLogService {
  private feedBuf: FeedEntry[] = []
  private nodeBuf: NodeEntry[] = []

  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
  ) {}

  private now(): string {
    return new Date().toLocaleTimeString('zh-CN', { hour12: false })
  }

  pushFeed(kind: string, text: string): void {
    const entry: FeedEntry = { kind, text, time: this.now() }
    this.feedBuf = [...this.feedBuf, entry].slice(-FEED_KEEP)
    this.bus.emit('feed', entry)
    void this.prisma.eventFeed.create({ data: { kind, text } }).catch(() => undefined)
  }

  pushNode(title: string, detail: string, disasterId?: number): void {
    const entry: NodeEntry = { title, detail, time: this.now() }
    this.nodeBuf = [...this.nodeBuf, entry].slice(-NODE_KEEP)
    this.bus.emit('node', entry)
    void this.prisma.nodeRecord.create({ data: { title, detail, disasterId: disasterId ?? null } }).catch(() => undefined)
  }

  /** 新连入的大屏拉取最近历史 */
  recent(): { feed: FeedEntry[]; nodes: NodeEntry[] } {
    return { feed: [...this.feedBuf], nodes: [...this.nodeBuf] }
  }
}
