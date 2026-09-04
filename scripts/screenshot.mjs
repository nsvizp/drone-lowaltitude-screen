// 大屏截图验收脚本：node scripts/screenshot.mjs
import { chromium } from 'playwright'
const BASE = process.env.SCREEN_URL ?? 'http://127.0.0.1:5173'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173'
const OUT = new URL('../shots/', import.meta.url).pathname

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })

// 1. 登录页
await page.goto(BASE + '/#/login', { waitUntil: 'networkidle' })
await page.screenshot({ path: OUT + '1-login.png' })

// 2. 大屏（通过 init script 预置 token，应用启动前生效）
await page.addInitScript(() => localStorage.setItem('drone-screen-token', 'mock-token-shot'))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(3500) // 等面板数据 + 无人机推进几帧
await page.screenshot({ path: OUT + '2-screen.png' })

// 3. 交互验收：切换任务周期与状态
await page.getByRole('button', { name: '本月', exact: true }).click()
await page.getByRole('button', { name: /已接单/ }).click()
await page.waitForTimeout(600)
await page.screenshot({ path: OUT + '3-task-filter.png' })

// 4. 再推进几秒，观察无人机移动
await page.waitForTimeout(3000)
await page.screenshot({ path: OUT + '4-screen-later.png' })

await browser.close()
console.log('screenshots saved to', OUT)