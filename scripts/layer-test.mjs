import { chromium } from 'playwright'
const BASE = process.env.SCREEN_URL ?? 'http://127.0.0.1:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(() => localStorage.setItem('drone-screen-token', 'mock-token-shot'))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)

// 默认不显示：应急 marker 应全部隐藏
const hiddenCount = await page.locator('.emergency-marker:visible').count()
console.log('默认可见应急 marker 数:', hiddenCount)
await page.screenshot({ path: 'shots/8-layers-default-off.png' })

// 打开三个图层
await page.getByRole('button', { name: /模拟物资/ }).click()
await page.getByRole('button', { name: /应急人员/ }).click()
await page.getByRole('button', { name: /应急车辆/ }).click()
await page.waitForTimeout(800)
const shownCount = await page.locator('.emergency-marker:visible').count()
console.log('开启后可见应急 marker 数:', shownCount)
await page.screenshot({ path: 'shots/9-layers-on.png' })

// 点击一个物资点看弹窗
await page.locator('.emergency-marker:visible').first().click({ force: true })
await page.waitForTimeout(600)
console.log('infowindow 数:', await page.locator('.amap-info').count())
await page.screenshot({ path: 'shots/10-supply-info.png' })

// 关闭物资图层验证隐藏
await page.getByRole('button', { name: /模拟物资/ }).click()
await page.waitForTimeout(500)
console.log('关闭物资图层后可见数:', await page.locator('.emergency-marker:visible').count())

await browser.close()
console.log('layer test done')