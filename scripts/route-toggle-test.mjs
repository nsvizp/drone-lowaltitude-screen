import { chromium } from 'playwright'
const BASE = process.env.SCREEN_URL ?? 'http://127.0.0.1:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(() => localStorage.setItem('drone-screen-token', 'mock-token-shot'))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(4000)
await page.screenshot({ path: 'shots/17-routes-hidden.png' })
await page.getByRole('button', { name: /巡航航线/ }).click()
await page.waitForTimeout(1000)
await page.screenshot({ path: 'shots/18-routes-shown.png' })
await browser.close()
console.log('route toggle shots done')