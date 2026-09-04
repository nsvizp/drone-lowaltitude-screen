import { chromium } from 'playwright'
const BASE = process.env.SCREEN_URL ?? 'http://127.0.0.1:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)))
await page.addInitScript(() => localStorage.setItem('drone-screen-token', 'mock-token-shot'))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)

// 1. 触发洪灾
await page.getByRole('button', { name: /模拟洪灾/ }).click()
await page.waitForTimeout(4000)
console.log('报警条:', await page.locator('.alarm-banner').count(), '| 调配单:', await page.locator('.dispatch-card').count())
await page.screenshot({ path: 'shots/11-flood-dispatch.png' })

// 2. 等待事件流（探针直读，最多 180s）
let firstEventAt = 0
for (let i = 0; i < 18; i++) {
  await page.waitForTimeout(10000)
  const s = await page.evaluate(() => ({
    survey: window.__FLEET?.drones?.filter(x => x.mission === 'survey').map(x => x.name.split('-').pop() + ':' + x.status),
    events: window.__DISASTER?.situation?.value?.events?.length ?? 0,
  }))
  if (i % 3 === 0 || s.events > 0) console.log((i + 1) * 10 + 's', JSON.stringify(s))
  if (s.events > 0) { firstEventAt = (i + 1) * 10; break }
}
await page.waitForTimeout(3000)
await page.screenshot({ path: 'shots/12-situation-feed.png' })
console.log('DOM 事件数:', await page.locator('.situation-card__event:not(.situation-card__event--dim)').count())

// 3. 视频窗：先真实点击（最多 3 次），失败则用调试钩子编程打开
let videoOpened = false
let viaClick = false
for (let attempt = 0; attempt < 3 && !videoOpened; attempt++) {
  await page.locator('.drone-marker:visible').first().click({ force: true })
  await page.waitForTimeout(700)
  const btn = page.locator('.js-video-btn')
  if (await btn.count()) {
    await btn.first().click({ force: true })
    await page.waitForTimeout(1200)
    videoOpened = (await page.locator('.video-feed').count()) > 0
    if (videoOpened) viaClick = true
  }
}
if (!videoOpened) {
  await page.evaluate(() => window.__DISASTER?.openVideo?.('drone-1'))
  await page.waitForTimeout(1200)
  videoOpened = (await page.locator('.video-feed').count()) > 0
}
console.log('视频窗:', videoOpened ? (viaClick ? 'OK(点击)' : 'OK(编程)') : 'FAIL')
if (videoOpened) await page.screenshot({ path: 'shots/13-video-feed.png' })

// 4. 等待评估翻「需要增援」（最多 5 分钟），出现后执行增援
let neededAt = 0
for (let i = 0; i < 30; i++) {
  const needed = await page.evaluate(() => window.__DISASTER?.evalResult?.value?.needed ?? false)
  if (needed) { neededAt = i * 10; break }
  await page.waitForTimeout(10000)
}
console.log('需要增援:', neededAt >= 0 && (await page.locator('.situation-card__btn').count()) > 0 ? 'YES' : 'NO')
if ((await page.locator('.situation-card__btn').count()) > 0) {
  await page.screenshot({ path: 'shots/14-reinforce-eval.png' })
  await page.locator('.situation-card__btn').click()
  await page.waitForTimeout(3000)
  const r = await page.evaluate(() => window.__FLEET?.drones?.filter(x => x.name.includes('-R')).map(x => x.name + ':' + x.status))
  console.log('增援机队:', JSON.stringify(r))
  await page.screenshot({ path: 'shots/15-reinforced.png' })
}
console.log('firstEventAt:', firstEventAt, 'neededAt:', neededAt)
await browser.close()
console.log('disaster test done')