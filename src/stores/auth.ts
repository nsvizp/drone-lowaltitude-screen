import { defineStore } from 'pinia'

const TOKEN_KEY = 'drone-screen-token'

interface LoginParams {
  username: string
  password: string
}

/** Mock 登录：账号 admin / 密码 admin123（真实后端接入后替换为接口调用） */
const MOCK_USER = { username: 'admin', password: 'admin123', displayName: 'Admin' }

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) ?? '',
    displayName: localStorage.getItem(TOKEN_KEY) ? MOCK_USER.displayName : '',
  }),
  getters: {
    isLoggedIn: (s) => s.token !== '',
  },
  actions: {
    async login({ username, password }: LoginParams): Promise<void> {
      await new Promise((r) => setTimeout(r, 300))
      if (username === MOCK_USER.username && password === MOCK_USER.password) {
        this.token = 'mock-token-' + Date.now()
        this.displayName = MOCK_USER.displayName
        localStorage.setItem(TOKEN_KEY, this.token)
        return
      }
      throw new Error('用户名或密码错误')
    },
    logout() {
      this.token = ''
      this.displayName = ''
      localStorage.removeItem(TOKEN_KEY)
    },
  },
})
