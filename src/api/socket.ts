import { ref } from 'vue'
import { io, type Socket } from 'socket.io-client'
import { getToken } from './http'

let socket: Socket | null = null

/** 后端连接状态（WS 在线=true；离线时灾情/模拟不可用） */
export const backendOnline = ref(false)

/** 全局 socket 单例（经 vite 代理连后端 /socket.io） */
export function getSocket(): Socket {
  if (!socket) {
    socket = io({ path: '/socket.io', transports: ['websocket', 'polling'], auth: { token: getToken() } })
    socket.on('connect', () => { backendOnline.value = true })
    socket.on('disconnect', () => { backendOnline.value = false })
    socket.on('connect_error', () => { backendOnline.value = false })
  }
  return socket
}
