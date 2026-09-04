import { chromium } from 'playwright'
const BASE = process.env.SCREEN_URL ?? 'http://127.0.0.1:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(() => localStorage.setItem('drone-screen-token', 'mock-token-shot'))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
// 无人机每秒移动，用 force 点击绕过稳定性检查
await page.locator('.drone-marker').first().click({ force: true })
await page.waitForTimeout(800)
const infoVisible = await page.locator('.amap-info-window, .amap-info').count()
console.log('infowindow count:', infoVisible)
await page.screenshot({ path: 'shots/7-drone-info.png' })
await browser.close()
console.log('done')