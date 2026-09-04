const BASE = process.env.SCREEN_URL ?? 'http://127.0.0.1:5173'
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)))
await page.addInitScript(() => localStorage.setItem('drone-screen-token', 'mock-token-shot'))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)

const snap = async (tag) => {
  const s = await page.evaluate(() => ({
    flood: window.__DISASTER?.flood?.value?.position?.map((n) => n.toFixed(3)).join(','),
    survey: window.__DISASTER?.plan?.value?.survey?.length,
    delivery: window.__DISASTER?.plan?.value?.delivery ? window.__DISASTER.plan.value.delivery.droneCount : null,
  }))
  console.log(tag, JSON.stringify(s))
}

// 第一次模拟
await page.locator('button.center-map__disaster').first().click()
await page.waitForTimeout(3000)
await snap('第一次模拟后:')
// 结束
await page.locator('button.center-map__disaster--resolve').click()
await page.waitForTimeout(1500)
await snap('结束后:')
// 第二次模拟
await page.locator('button.center-map__disaster').first().click()
await page.waitForTimeout(3000)
await snap('第二次模拟后:')
// 服务端直接查
const srv = await page.evaluate(async () => {
  const r = await fetch('/api/disaster/state')
  const s = await r.json()
  return { flood: !!s.flood, survey: s.plan?.survey?.length, delivery: !!s.plan?.delivery }
})
console.log('服务端状态:', JSON.stringify(srv))
await browser.close()
