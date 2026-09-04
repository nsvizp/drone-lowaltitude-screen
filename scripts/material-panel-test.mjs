import { chromium } from 'playwright'
const BASE = process.env.SCREEN_URL ?? 'http://127.0.0.1:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(() => localStorage.setItem('drone-screen-token', 'mock-token-shot'))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
await page.getByRole('button', { name: /模拟洪灾/ }).click()
await page.waitForTimeout(4000)
console.log('灾后在途架次:', await page.locator('.mat__stat-num--blue').first().textContent())
const rows = await page.locator('.mat__row').allTextContents()
console.log('调度行:', JSON.stringify(rows.slice(0, 3)))
await page.waitForTimeout(200000) // 等空投完成
console.log('空投后已投送:', await page.locator('.mat__stat-num--cyan').first().textContent())
await page.screenshot({ path: 'shots/21-material-panel.png' })
await browser.close()