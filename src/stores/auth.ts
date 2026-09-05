import { defineStore } from 'pinia'
import { getToken, TOKEN_KEY } from '@/api/http'
import { disconnectSocket, reconnectSocket } from '@/api/socket'

interface LoginParams {
  username: string
  password: string
}

/** 登录错误：透传服务端锁定信息 */
export class LoginError extends Error {
  remainSec = 0
  attemptsLeft: number | undefined
}

/** 调后端 /api/auth/login（bcrypt 校验 + 服务端失败锁定） */
export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: getToken(),
    displayName: getToken() ? 'Admin' : '',
  }),
  getters: {
    isLoggedIn: (s) => s.token !== '',
  },
  actions: {
    async login({ username, password }: LoginParams): Promise<void> {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const err = new LoginError(body.message ?? '登录失败')
        err.remainSec = body.remainSec ?? 0
        err.attemptsLeft = body.attemptsLeft
        throw err
      }
      this.token = body.token
      this.displayName = body.displayName
      localStorage.setItem(TOKEN_KEY, this.token)
      reconnectSocket()
    },
    logout() {
      this.token = ''
      this.displayName = ''
      localStorage.removeItem(TOKEN_KEY)
      disconnectSocket()
    },
  },
})
