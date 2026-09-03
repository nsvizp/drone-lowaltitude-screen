import { onBeforeUnmount, type Ref } from 'vue'

/** 把面板位置钳制在容器内（纯函数，可测） */
export function clampPosition(
  x: number, y: number, w: number, h: number, containerW: number, containerH: number,
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(0, x), Math.max(0, containerW - w)),
    y: Math.min(Math.max(0, y), Math.max(0, containerH - h)),
  }
}

/** 按拖拽增量计算新尺寸，受最小/最大约束（纯函数，可测） */
export function computeResized(
  start: { w: number; h: number },
  dx: number,
  dy: number,
  opts: { minW: number; minH: number; maxW?: number; maxH?: number },
): { w: number; h: number } {
  const w = Math.max(opts.minW, start.w + dx)
  const h = Math.max(opts.minH, start.h + dy)
  return {
    w: opts.maxW === undefined ? w : Math.min(opts.maxW, w),
    h: opts.maxH === undefined ? h : Math.min(opts.maxH, h),
  }
}

/** 首次拖动时把 right/bottom/transform 定位固化为 left/top（返回 false 表示无法定位） */
function adoptAbsolutePosition(el: HTMLElement): boolean {
  const parent = el.offsetParent as HTMLElement | null
  if (!parent) return false
  const rect = el.getBoundingClientRect()
  const prect = parent.getBoundingClientRect()
  el.style.left = rect.left - prect.left + 'px'
  el.style.top = rect.top - prect.top + 'px'
  el.style.right = 'auto'
  el.style.bottom = 'auto'
  el.style.transform = 'none'
  return true
}

interface DragCtx {
  pointerId: number
  startX: number
  startY: number
  baseX: number
  baseY: number
  cleanup: () => void
}

/**
 * 让浮动面板可拖动：按住 handle 拖动 target。
 * 位置钳制在 offsetParent（地图容器）内；点击 handle 内的按钮不触发拖动。
 */
export function useDraggable(target: Ref<HTMLElement | null>, handle: Ref<HTMLElement | null>): void {
  let ctx: DragCtx | null = null

  const onDown = (e: PointerEvent) => {
    const el = target.value
    if (!el || e.button !== 0) return
    if ((e.target as HTMLElement).closest('button')) return // 关闭等按钮不抢拖动
    if (!adoptAbsolutePosition(el)) return
    const handleEl = handle.value
    if (!handleEl) return
    ctx = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseX: parseFloat(el.style.left) || 0,
      baseY: parseFloat(el.style.top) || 0,
      cleanup: () => handleEl.releasePointerCapture(e.pointerId),
    }
    handleEl.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  const onMove = (e: PointerEvent) => {
    const el = target.value
    if (!ctx || !el || e.pointerId !== ctx.pointerId) return
    const parent = el.offsetParent as HTMLElement
    const next = clampPosition(
      ctx.baseX + e.clientX - ctx.startX,
      ctx.baseY + e.clientY - ctx.startY,
      el.offsetWidth, el.offsetHeight,
      parent.clientWidth, parent.clientHeight,
    )
    el.style.left = next.x + 'px'
    el.style.top = next.y + 'px'
  }

  const onUp = (e: PointerEvent) => {
    if (!ctx || e.pointerId !== ctx.pointerId) return
    ctx.cleanup()
    ctx = null
  }

  const attach = () => {
    const h = handle.value
    if (!h) return
    h.addEventListener('pointerdown', onDown)
    h.addEventListener('pointermove', onMove)
    h.addEventListener('pointerup', onUp)
    h.addEventListener('pointercancel', onUp)
  }
  // setup 阶段 handle 尚未渲染，用微任务/多次尝试挂载
  const tryAttach = () => (handle.value ? attach() : setTimeout(tryAttach, 50))
  setTimeout(tryAttach, 0)

  onBeforeUnmount(() => {
    const h = handle.value
    if (!h) return
    h.removeEventListener('pointerdown', onDown)
    h.removeEventListener('pointermove', onMove)
    h.removeEventListener('pointerup', onUp)
    h.removeEventListener('pointercancel', onUp)
  })
}

/** 让浮动面板可通过右下角手柄缩放 */
export function useResizable(
  target: Ref<HTMLElement | null>,
  grip: Ref<HTMLElement | null>,
  opts: { minW: number; minH: number; maxW?: number; maxH?: number; axis?: 'x' | 'both' },
): void {
  let ctx: { pointerId: number; startX: number; startY: number; baseW: number; baseH: number } | null = null

  const onDown = (e: PointerEvent) => {
    const el = target.value
    const g = grip.value
    if (!el || !g || e.button !== 0) return
    adoptAbsolutePosition(el)
    ctx = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, baseW: el.offsetWidth, baseH: el.offsetHeight }
    g.setPointerCapture(e.pointerId)
    e.preventDefault()
  }
  const onMove = (e: PointerEvent) => {
    const el = target.value
    if (!ctx || !el || e.pointerId !== ctx.pointerId) return
    const size = computeResized({ w: ctx.baseW, h: ctx.baseH }, e.clientX - ctx.startX, e.clientY - ctx.startY, opts)
    el.style.width = size.w + 'px'
    if (opts.axis !== 'x') {
      el.style.maxHeight = 'none'
      el.style.height = size.h + 'px'
    }
  }
  const onUp = (e: PointerEvent) => {
    if (ctx && e.pointerId === ctx.pointerId) ctx = null
  }

  const attach = () => {
    const g = grip.value
    if (!g) return
    g.addEventListener('pointerdown', onDown)
    g.addEventListener('pointermove', onMove)
    g.addEventListener('pointerup', onUp)
    g.addEventListener('pointercancel', onUp)
  }
  const tryAttach = () => (grip.value ? attach() : setTimeout(tryAttach, 50))
  setTimeout(tryAttach, 0)

  onBeforeUnmount(() => {
    const g = grip.value
    if (!g) return
    g.removeEventListener('pointerdown', onDown)
    g.removeEventListener('pointermove', onMove)
    g.removeEventListener('pointerup', onUp)
    g.removeEventListener('pointercancel', onUp)
  })
}
