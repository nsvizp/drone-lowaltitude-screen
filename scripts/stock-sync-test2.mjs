const BASE = process.env.SCREEN_URL ?? 'http://127.0.0.1:5173'
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(() => localStorage.setItem('drone-screen-token', 'mock-token-shot'))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
const site = await page.evaluate(() => window.__DISASTER.plan.value?.delivery?.supplySiteName)
const stockBefore = await page.evaluate(async (name) => {
  const r = await fetch('/api/warehouses'); const rows = await r.json()
  return rows.find((w) => w.name === name)?.stock
}, site)
console.log('来源仓:', site, '投前库存:', stockBefore)
let dropped = false
for (let i = 0; i < 120 && !dropped; i++) {
  await page.waitForTimeout(2000)
  dropped = await page.evaluate(() => (window.__DISASTER.situation.value?.deliveredPacks ?? 0) > 0)
}
console.log('空投发生:', dropped ? 'OK' : 'FAIL(超时)')
if (dropped) {
  const delivered = await page.evaluate(() => window.__DISASTER.situation.value.deliveredPacks)
  const stockAfter = await page.evaluate(async (name) => {
    const r = await fetch('/api/warehouses'); const rows = await r.json()
    return rows.find((w) => w.name === name)?.stock
  }, site)
  console.log('投送:', delivered, '件 | 库存', stockBefore, '→', stockAfter, stockBefore - stockAfter === delivered ? '实时扣减 OK' : 'FAIL')
  const panelText = await page.locator('.mat__wh', { hasText: site }).first().textContent()
  console.log('仓储面板:', panelText.replace(/\s+/g, ' ').slice(0, 55), panelText.includes(String(stockAfter)) ? '面板同步 OK' : '面板FAIL')
  const sitLast = await page.evaluate(() => {
    const evs = window.__DISASTER.situation.value?.events ?? []
    return (evs[evs.length - 1]?.text ?? '').slice(0, 20)
  })
  const feedTexts = await page.locator('.feed__item').allTextContents()
  console.log('态势事件「' + sitLast + '…」在事件流中:', feedTexts.some((t) => t.includes(sitLast)) ? 'OK 同源' : 'FAIL')
}
await page.screenshot({ path: 'shots/25-stock-sync.png' })
await browser.close()
