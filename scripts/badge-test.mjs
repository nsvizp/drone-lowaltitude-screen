const BASE = process.env.SCREEN_URL ?? 'http://127.0.0.1:5173'
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(() => localStorage.setItem('drone-screen-token', 'mock-token-shot'))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
console.log('角标:', await page.locator('.center-map__backend').textContent())
// 结束当前演练恢复初始，验证两轮
const rb = page.locator('button.center-map__disaster--resolve')
if (await rb.count()) { await rb.click(); await page.waitForTimeout(1500) }
await page.locator('button.center-map__disaster').first().click()
await page.waitForTimeout(2500)
console.log('第一轮:', await page.evaluate(() => window.__DISASTER.flood.value !== null) ? 'OK' : 'FAIL')
await page.locator('button.center-map__disaster--resolve').click()
await page.waitForTimeout(1500)
await page.locator('button.center-map__disaster').first().click()
await page.waitForTimeout(2500)
console.log('第二轮:', await page.evaluate(() => window.__DISASTER.flood.value !== null) ? 'OK' : 'FAIL')
await page.screenshot({ path: 'shots/24-backend-badge.png' })
await browser.close()
