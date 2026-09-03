import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(() => localStorage.setItem('drone-screen-token', 'mock-token-shot'))
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
await page.getByRole('button', { name: /模拟洪灾/ }).click()
console.log('洪灾已触发，等待投送机完成全程归舱…')

let docked = 0
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(10000)
  const s = await page.evaluate(() => {
    const f = window.__FLEET
    return {
      total: f.drones.length,
      delivery: f.drones.filter(d => d.mission === 'delivery').map(d => d.name.split('-').pop() + ':' + d.status),
      statuses: f.drones.map(d => d.status),
    }
  })
  docked = s.delivery.filter(x => x.includes('docked')).length
  if (i % 3 === 0 || docked > 0) console.log((i + 1) * 10 + 's', 'total:' + s.total, JSON.stringify(s.delivery))
  if (docked >= 2) break
}

// 归舱后核对：可见 marker 数 == 飞行中+返航 芯片数字
await page.waitForTimeout(3000)
const check = await page.evaluate(() => {
  const f = window.__FLEET
  const visibleExpected = f.drones.filter(d => d.status !== 'docked').length
  const chips = [...document.querySelectorAll('.center-map__chip')].map(c => c.textContent.trim())
  const visibleMarkers = document.querySelectorAll('.drone-marker').length
  const visibleNow = [...document.querySelectorAll('.drone-marker')].filter(el => el.offsetParent !== null || el.getClientRects().length > 0).length
  return { visibleExpected, chips, visibleMarkers, visibleNow }
})
console.log('核对:', JSON.stringify(check, null, 1))
await page.screenshot({ path: 'shots/16-after-dock.png' })
await browser.close()
console.log('cleanup verify done')
