import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      // 模拟引擎共享层：前端与后端共用同一份 shared/sim 代码
      { find: '@/sim', replacement: fileURLToPath(new URL('./shared/sim', import.meta.url)) },
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
    ],
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    // 开发期代理到本地后端（NestJS，tsx watch 热重载）
    proxy: {
      '/api': { target: process.env.BACKEND_URL ?? 'http://127.0.0.1:3000', changeOrigin: true },
      '/socket.io': { target: process.env.BACKEND_URL ?? 'http://127.0.0.1:3000', ws: true, changeOrigin: true },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'shared/**/*.test.ts'],
  },
} as never)
