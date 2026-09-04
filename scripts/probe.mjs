import { chromium } from 'playwright'
const BASE = process.env.SCREEN_URL ?? 'http://127.0.0.1:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(() => localStorage.setItem('drone-screen-token', 'mock-token-shot'))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
await page.getByRole('button', { name: /模拟洪灾/ }).click()
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(10000)
  const s = await page.evaluate(() => {
    const f = window.__FLEET
    const d = window.__DISASTER
    return {
      tick: f?.tickCount,
      survey: f?.drones?.filter(x => x.mission === 'survey').map(x => x.name + ':' + x.status + ':' + Math.round(x.battery)),
      floodSet: !!d?.flood?.value,
      situationEvents: d?.situation?.value?.events?.length,
      evalNeeded: d?.evalResult?.value?.needed,
    }
  })
  console.log((i + 1) * 10 + 's', JSON.stringify(s))
  if ((s.situationEvents ?? 0) > 0) break
}
await browser.close()