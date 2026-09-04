const BASE = process.env.SCREEN_URL ?? 'http://127.0.0.1:5173'
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
let configHit = false
page.on('request', (r) => { if (r.url().includes('/api/config/public')) configHit = true })
await page.addInitScript(() => localStorage.setItem('drone-screen-token', 'mock-token-shot'))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(4000)
console.log('请求了 /api/config/public:', configHit)
console.log('地图加载(AMap):', await page.evaluate(() => typeof window.AMap !== 'undefined'))
console.log('机队在跑:', await page.evaluate(() => (window.__FLEET?.drones?.length ?? 0) > 0))
// 登录页→错误密码→剩余次数提示（验证码绕过不了，直接调 store 验证链路）
const res = await page.evaluate(async () => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'Wrong@123' }) })
  return { status: r.status, body: await r.json() }
})
console.log('前端 fetch 错误密码:', JSON.stringify(res))
await browser.close()
