import { Injectable } from '@nestjs/common'
import { EventEmitter } from 'node:events'

/** 进程内事件总线：service 发、gateway 收（广播给所有大屏） */
@Injectable()
export class EventBus {
  readonly emitter = new EventEmitter()

  emit(channel: 'feed' | 'node' | 'disaster', payload: unknown): void {
    this.emitter.emit(channel, payload)
  }

  on(channel: string, fn: (payload: unknown) => void): void {
    this.emitter.on(channel, fn)
  }
}
