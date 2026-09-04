const BASE = process.env.SCREEN_URL ?? 'http://127.0.0.1:5173'
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(() => localStorage.setItem('drone-screen-token', 'mock-token-shot'))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
const rb = page.locator('button.center-map__disaster--resolve')
if (await rb.count()) { await rb.click(); await page.waitForTimeout(1200) }

const stockBefore = await page.evaluate(async () => {
  const r = await fetch('/api/warehouses')
  const rows = await r.json()
  return rows.map((w) => w.name + ':' + w.stock)
})
await page.locator('button.center-map__disaster').first().click()
// 等空投发生（投送飞行需要时间，轮询最多 90s）
let dropped = false
for (let i = 0; i < 45 && !dropped; i++) {
  await page.waitForTimeout(2000)
  dropped = await page.evaluate(() => (window.__DISASTER.situation.value?.deliveredPacks ?? 0) > 0)
}
console.log('空投发生:', dropped ? 'OK' : 'FAIL(超时)')
if (dropped) {
  const delivered = await page.evaluate(() => window.__DISASTER.situation.value.deliveredPacks)
  const site = await page.evaluate(() => window.__DISASTER.plan.value?.delivery?.supplySiteName)
  const stockAfter = await page.evaluate(async (name) => {
    const r = await fetch('/api/warehouses')
    const rows = await r.json()
    return rows.find((w) => w.name === name)?.stock
  }, site)
  const before = stockBefore.find((s) => s.startsWith(site + ':'))?.split(':')[1]
  console.log('来源仓:', site, '| 投送:', delivered, '件 | 库存', before, '→', stockAfter, Number(before) - stockAfter === delivered ? '实时扣减 OK' : 'FAIL')
  // 面板上的库存条同步？
  const panelText = await page.locator('.mat__wh', { hasText: site }).first().textContent()
  console.log('仓储面板行:', panelText.replace(/\s+/g, ' ').slice(0, 60), panelText.includes(String(stockAfter)) ? '面板同步 OK' : '面板FAIL')
  // 态势 vs 事件流同源检查：最后一条 supply 事件应同时出现在两处
  const sitLast = await page.evaluate(() => {
    const evs = window.__DISASTER.situation.value?.events ?? []
    return evs[evs.length - 1]?.text ?? ''
  })
  const feedTexts = await page.locator('.feed__item').allTextContents()
  console.log('态势末条在事件流中:', feedTexts.some((t) => t.includes(sitLast.slice(0, 20))) ? 'OK' : 'FAIL')
}
await page.screenshot({ path: 'shots/25-stock-sync.png' })
await browser.close()
