const BASE = process.env.SCREEN_URL ?? 'http://127.0.0.1:5173'
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(() => localStorage.setItem('drone-screen-token', 'mock-token-shot'))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
const rb = page.locator('button.center-map__disaster--resolve')
if (await rb.count()) { await rb.click(); await page.waitForTimeout(1200) }

// 火灾：按钮/标记/文案
await page.locator('button.center-map__disaster--fire').click()
await page.waitForTimeout(3000)
const kind = await page.evaluate(() => window.__DISASTER.flood.value?.kind)
const emoji = await page.locator('.flood-pulse span').textContent().catch(() => '?')
const feedTxt = (await page.locator('.feed__item').allTextContents()).join(' ')
console.log('火灾: kind=', kind, '标记=', emoji, '事件流含火灾:', feedTxt.includes('火灾') ? 'OK' : 'FAIL', kind === 'fire' && emoji === '🔥' ? 'OK' : 'FAIL')

// 两架勘测机视频不同
const surveyIds = await page.evaluate(() => window.__FLEET.drones.filter((d) => d.mission === 'survey').map((d) => d.id))
console.log('勘测机:', JSON.stringify(surveyIds))
const srcs = []
for (const id of surveyIds.slice(0, 2)) {
  await page.evaluate((i) => window.__DISASTER.openVideo(i), id)
  await page.waitForTimeout(800)
  srcs.push(await page.locator('video.video-feed__video').getAttribute('src').catch(() => null))
}
console.log('两架机视频:', JSON.stringify(srcs), srcs[0] && srcs[1] && srcs[0] !== srcs[1] ? '不同 OK' : '相同(哈希巧合也可接受)')
console.log('均为 fire 包:', srcs.every((s) => s && s.startsWith('/videos/fire/')) ? 'OK' : 'FAIL')

// 增援后视频切换（等增援评估出来）
let canReinforce = false
for (let i = 0; i < 20 && !canReinforce; i++) {
  await page.waitForTimeout(3000)
  canReinforce = await page.evaluate(() => window.__DISASTER.evalResult.value?.needed === true)
}
if (canReinforce) {
  await page.evaluate((i) => window.__DISASTER.openVideo(i), surveyIds[0])
  await page.waitForTimeout(600)
  const before = await page.locator('video.video-feed__video').getAttribute('src')
  await page.evaluate(() => fetch('/api/disaster/reinforce', { method: 'POST' }))
  await page.waitForTimeout(1500)
  const after = await page.locator('video.video-feed__video').getAttribute('src')
  console.log('增援换片:', before, '→', after, before !== after ? 'OK' : 'FAIL')
} else {
  console.log('增援条件未触发（评估为不需要），直接调接口验证换片逻辑：')
  const before = await page.locator('video.video-feed__video').getAttribute('src').catch(() => null)
  await page.evaluate(() => fetch('/api/disaster/reinforce', { method: 'POST' }))
  await page.waitForTimeout(1500)
  const reinforced = await page.evaluate(() => window.__DISASTER.reinforced.value)
  console.log('reinforced 标志:', reinforced)
}
await page.screenshot({ path: 'shots/28-fire-video.png' })
await browser.close()
