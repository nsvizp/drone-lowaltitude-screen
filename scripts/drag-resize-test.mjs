import { chromium } from 'playwright'
const BASE = process.env.SCREEN_URL ?? 'http://127.0.0.1:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)))
await page.addInitScript(() => localStorage.setItem('drone-screen-token', 'mock-token-shot'))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
await page.getByRole('button', { name: /模拟洪灾/ }).click()
await page.waitForTimeout(2000)
// 打开视频窗（编程方式，避免移动靶点击抖动）
await page.evaluate(() => window.__DISASTER?.openVideo?.('drone-1'))
await page.waitForTimeout(800)

const sit = page.locator('.situation-card')
const vid = page.locator('.video-feed')
console.log('态势卡存在:', await sit.count(), '| 视频窗存在:', await vid.count())

// --- 拖动态势卡（标题栏） ---
const b1 = await sit.boundingBox()
const h1 = await sit.locator('.situation-card__drag').boundingBox()
await page.mouse.move(h1.x + h1.width / 2, h1.y + h1.height / 2)
await page.mouse.down()
await page.mouse.move(h1.x + h1.width / 2 - 300, h1.y + h1.height / 2 - 200, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(300)
const b2 = await sit.boundingBox()
console.log('态势卡拖动:', '前(' + Math.round(b1.x) + ',' + Math.round(b1.y) + ') → 后(' + Math.round(b2.x) + ',' + Math.round(b2.y) + ')',
  Math.abs(b2.x - b1.x) > 200 && Math.abs(b2.y - b1.y) > 100 ? 'OK' : 'FAIL')

// --- 缩放态势卡（右下角手柄） ---
const g1 = await sit.locator('.situation-card__resize').boundingBox()
await page.mouse.move(g1.x + 7, g1.y + 7)
await page.mouse.down()
await page.mouse.move(g1.x + 7 + 150, g1.y + 7 + 100, { steps: 8 })
await page.mouse.up()
await page.waitForTimeout(300)
const b3 = await sit.boundingBox()
console.log('态势卡缩放:', Math.round(b2.width) + 'x' + Math.round(b2.height) + ' → ' + Math.round(b3.width) + 'x' + Math.round(b3.height),
  b3.width > b2.width + 100 && b3.height > b2.height + 60 ? 'OK' : 'FAIL')

// --- 拖动视频窗 ---
const v1 = await vid.boundingBox()
const vb = await vid.locator('.video-feed__drag').boundingBox()
await page.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2)
await page.mouse.down()
await page.mouse.move(vb.x + vb.width / 2 - 400, vb.y + vb.height / 2 - 250, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(300)
const v2 = await vid.boundingBox()
console.log('视频窗拖动:', '前(' + Math.round(v1.x) + ',' + Math.round(v1.y) + ') → 后(' + Math.round(v2.x) + ',' + Math.round(v2.y) + ')',
  Math.abs(v2.x - v1.x) > 200 ? 'OK' : 'FAIL')

// --- 缩放视频窗（宽度） ---
const vg = await vid.locator('.video-feed__resize').boundingBox()
await page.mouse.move(vg.x + 7, vg.y + 7)
await page.mouse.down()
await page.mouse.move(vg.x + 7 + 260, vg.y + 7 + 150, { steps: 8 })
await page.mouse.up()
await page.waitForTimeout(400)
const v3 = await vid.boundingBox()
const canvasW = await page.evaluate(() => document.querySelector('.video-feed__canvas')?.width)
console.log('视频窗缩放:', Math.round(v2.width) + ' → ' + Math.round(v3.width), 'canvas 内部分辨率:', canvasW,
  v3.width > v2.width + 150 && canvasW > 500 ? 'OK' : 'FAIL')

await page.screenshot({ path: 'shots/19-drag-resize.png' })
await browser.close()
console.log('drag/resize test done')