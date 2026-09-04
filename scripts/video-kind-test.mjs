const BASE = process.env.SCREEN_URL ?? 'http://127.0.0.1:5173'
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const vids = []
page.on('request', (r) => { if (r.url().includes('/videos/')) vids.push(r.url().split('/').pop()) })
await page.addInitScript(() => localStorage.setItem('drone-screen-token', 'mock-token-shot'))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
const rb = page.locator('button.center-map__disaster--resolve')
if (await rb.count()) { await rb.click(); await page.waitForTimeout(1200) }

// ── 洪灾：按钮 + 标记 + 视频
const btns = await page.locator('button.center-map__disaster').allTextContents()
console.log('灾种按钮:', JSON.stringify(btns.map((t) => t.trim())))
await page.locator('button.center-map__disaster').first().click()
await page.waitForTimeout(3000)
const kind1 = await page.evaluate(() => window.__DISASTER.flood.value?.kind)
const emoji1 = await page.locator('.flood-pulse span').textContent().catch(() => '?')
console.log('洪灾: kind=', kind1, '标记=', emoji1, kind1 === 'flood' && emoji1 === '🌊' ? 'OK' : 'FAIL')
// 打开勘测机视频（任一 survey 机）
await page.evaluate(() => {
  const d = window.__FLEET.drones.find((x) => x.mission === 'survey')
  if (d) window.__DISASTER.openVideo(d.id)
})
await page.waitForTimeout(1500)
const v1 = await page.locator('video.video-feed__video').getAttribute('src').catch(() => null)
console.log('勘测视频 src:', v1, v1 === '/videos/flood.mp4' ? 'OK' : 'FAIL')
await page.screenshot({ path: 'shots/26-video-flood.png' })
await page.locator('.video-feed__close').click()

// ── 结束后泥石流
await page.locator('button.center-map__disaster--resolve').click()
await page.waitForTimeout(1500)
await page.locator('button.center-map__disaster--debris').click()
await page.waitForTimeout(3000)
const kind2 = await page.evaluate(() => window.__DISASTER.flood.value?.kind)
const emoji2 = await page.locator('.flood-pulse span').textContent().catch(() => '?')
const feedTxt = (await page.locator('.feed__item').allTextContents()).join(' ')
console.log('泥石流: kind=', kind2, '标记=', emoji2, '事件流含泥石流:', feedTxt.includes('泥石流') ? 'OK' : 'FAIL')
await page.evaluate(() => {
  const d = window.__FLEET.drones.find((x) => x.mission === 'survey')
  if (d) window.__DISASTER.openVideo(d.id)
})
await page.waitForTimeout(1500)
const v2 = await page.locator('video.video-feed__video').getAttribute('src').catch(() => null)
console.log('勘测视频 src:', v2, v2 === '/videos/debris.mp4' ? 'OK' : 'FAIL')
console.log('视频文件请求:', JSON.stringify([...new Set(vids)]))
await page.screenshot({ path: 'shots/27-video-debris.png' })
await browser.close()
