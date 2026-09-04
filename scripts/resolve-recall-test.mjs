const BASE = process.env.SCREEN_URL ?? 'http://127.0.0.1:5173'
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(() => localStorage.setItem('drone-screen-token', 'mock-token-shot'))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
await page.locator('button.center-map__disaster').first().click()
await page.waitForTimeout(4000)
const during = await page.evaluate(() => ({
  mission: window.__FLEET.drones.filter((d) => d.mission !== 'patrol').length,
}))
console.log('抢险中任务机:', during.mission)
await page.locator('button.center-map__disaster--resolve').click()
await page.waitForTimeout(1500)
const after = await page.evaluate(() => ({
  flood: window.__DISASTER.flood.value !== null,
  mission: window.__FLEET.drones.filter((d) => d.mission !== 'patrol').map((d) => d.status),
  floodMarker: document.querySelector('.flood-pulse') !== null,
}))
console.log('结束后: flood=', after.flood, '| 任务机状态=', JSON.stringify(after.mission), '| 灾点标记=', after.floodMarker)
console.log(after.flood === false && after.floodMarker === false && after.mission.every((s) => s === 'returning' || s === 'docked') ? '全部清除 OK' : 'FAIL')
await page.screenshot({ path: 'shots/23-resolve-recall.png' })
await browser.close()
