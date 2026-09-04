import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

/** 全局 socket 单例（经 vite 代理连后端 /socket.io） */
export function getSocket(): Socket {
  if (!socket) {
    socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] })
  }
  return socket
}
