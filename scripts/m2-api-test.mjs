const BASE = process.env.SCREEN_URL ?? 'http://127.0.0.1:5173'
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const hits = []
page.on('request', (r) => { if (r.url().includes('/api/')) hits.push(r.url().replace(BASE, '')) })
await page.addInitScript(() => localStorage.setItem('drone-screen-token', 'mock-token-shot'))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(4500)
console.log('API 请求:', JSON.stringify(hits))
console.log('资源总览第一项:', (await page.locator('.overview__item').first().textContent())?.replace(/\s+/g, ' '))
console.log('仓储行数:', await page.locator('.mat__wh').count())
console.log('仓储首行:', (await page.locator('.mat__wh').first().textContent())?.replace(/\s+/g, ' ').slice(0, 80))
await browser.close()
