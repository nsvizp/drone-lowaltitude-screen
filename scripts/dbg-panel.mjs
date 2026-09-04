import { chromium } from 'playwright'
const BASE = process.env.SCREEN_URL ?? 'http://127.0.0.1:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)))
await page.addInitScript(() => localStorage.setItem('drone-screen-token', 'mock-token-shot'))
await page.goto(BASE + '/#/screen', { waitUntil: 'networkidle' })
await page.waitForTimeout(3500)
console.log('URL:', page.url())
console.log('panel titles:', await page.locator('.panel-card__title').allTextContents())
console.log('仓储行数:', await page.locator('.mat__wh').count())
await browser.close()