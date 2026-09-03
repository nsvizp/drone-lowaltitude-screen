import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.addInitScript(() => localStorage.setItem('drone-screen-token', 'mock-token-shot'))
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(4000)

// 打点：包装 AMap 原型方法计数 + FPS 采样
await page.evaluate(() => {
  const AMap = window.AMap
  window.__PERF = { setContent: 0, setPath: 0, setOptions: 0, frames: 0 }
  const mp = AMap.Marker.prototype
  const origSetContent = mp.setContent
  mp.setContent = function (...a) { window.__PERF.setContent++; return origSetContent.apply(this, a) }
  const pp = AMap.Polyline.prototype
  const origSetPath = pp.setPath
  pp.setPath = function (...a) { window.__PERF.setPath++; return origSetPath.apply(this, a) }
  const origSetOptions = pp.setOptions
  pp.setOptions = function (...a) { window.__PERF.setOptions++; return origSetOptions.apply(this, a) }
  const loop = () => { window.__PERF.frames++; requestAnimationFrame(loop) }
  requestAnimationFrame(loop)
  // DOM 突变计数
  window.__PERF.domMutations = 0
  new MutationObserver((list) => { window.__PERF.domMutations += list.length }).observe(
    document.querySelector('.center-map__canvas'), { childList: true, subtree: true, attributes: true })
})
await page.waitForTimeout(10000)
const perf = await page.evaluate(() => window.__PERF)
console.log('10 秒采样（无灾情，8 架巡逻）:')
console.log('  marker.setContent:', perf.setContent, '次 →', (perf.setContent / 10).toFixed(1), '次/秒')
console.log('  polyline.setPath:', perf.setPath, '次 →', (perf.setPath / 10).toFixed(1), '次/秒')
console.log('  polyline.setOptions:', perf.setOptions, '次 →', (perf.setOptions / 10).toFixed(1), '次/秒')
console.log('  地图容器 DOM 突变:', perf.domMutations, '次 →', (perf.domMutations / 10).toFixed(1), '次/秒')
console.log('  FPS:', (perf.frames / 10).toFixed(0))
await browser.close()
