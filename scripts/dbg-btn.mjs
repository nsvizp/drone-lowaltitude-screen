const BASE = process.env.SCREEN_URL ?? 'http://127.0.0.1:5173'
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 250)))
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 200)) })
await page.addInitScript(() => localStorage.setItem('drone-screen-token', 'mock-token-shot'))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(4000)
console.log('按钮数:', await page.locator('button.center-map__disaster').count())
console.log('按钮可见:', await page.locator('button.center-map__disaster').isVisible().catch(() => false))
console.log('图层面板数:', await page.locator('.center-map__layers').count())
console.log('disaster.active:', await page.evaluate(() => window.__DISASTER?.flood?.value))
await browser.close()
