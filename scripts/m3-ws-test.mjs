const BASE = process.env.SCREEN_URL ?? 'http://127.0.0.1:5173'
import { chromium } from 'playwright'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
await ctx.addInitScript(() => localStorage.setItem('drone-screen-token', 'mock-token-shot'))
const a = await ctx.newPage()
await a.goto(BASE + '/', { waitUntil: 'networkidle' })
await a.waitForTimeout(3000)
const b = await ctx.newPage()
await b.goto(BASE + '/', { waitUntil: 'networkidle' })
await b.waitForTimeout(3000)

// A 触发新灾情（REST，服务端权威）
const floodId = await a.evaluate(async () => {
  const r = await fetch('/api/disaster/simulate', { method: 'POST' })
  const s = await r.json()
  return s.flood.position.map((n) => n.toFixed(4)).join(',')
})
await a.waitForTimeout(2500)
const floodB = await b.evaluate(() => window.__DISASTER?.flood?.value?.position?.map((n) => n.toFixed(4)).join(','))
console.log('A 触发灾点:', floodId, '| B 同步看到:', floodB, floodB === floodId ? 'OK' : 'FAIL')

const feedB = await b.locator('.feed__item').count()
const nodeB = await b.locator('.nodes__item').count()
console.log('B 屏事件流:', feedB, '条 | 节点:', nodeB, '个', feedB >= 2 && nodeB >= 2 ? 'OK' : 'FAIL')

// 刷新 A：灾情仍在
await a.reload({ waitUntil: 'networkidle' })
await a.waitForTimeout(3000)
const after = await a.evaluate(() => window.__DISASTER?.flood?.value?.position?.map((n) => n.toFixed(4)).join(','))
console.log('A 刷新后灾情仍在:', after === floodId ? 'OK' : 'FAIL')

// 事件入库验证
const dbRows = await a.evaluate(async () => {
  const r = await fetch('/api/events/recent')
  const h = await r.json()
  return { feed: h.feed.length, nodes: h.nodes.length, last: h.nodes[h.nodes.length - 1] }
})
console.log('事件历史接口:', JSON.stringify(dbRows))
await a.screenshot({ path: 'shots/22-m3-ws.png' })
await browser.close()
