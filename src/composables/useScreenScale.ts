import { onBeforeUnmount, onMounted, ref } from 'vue'

export const DESIGN_WIDTH = 1920
export const DESIGN_HEIGHT = 1080

/** 计算等比缩放比例与居中偏移（纯函数，可测） */
export function computeScale(
  viewportW: number,
  viewportH: number,
  designW: number = DESIGN_WIDTH,
  designH: number = DESIGN_HEIGHT,
): { scale: number; offsetX: number; offsetY: number } {
  const scale = Math.min(viewportW / designW, viewportH / designH)
  return {
    scale,
    offsetX: (viewportW - designW * scale) / 2,
    offsetY: (viewportH - designH * scale) / 2,
  }
}

/** 大屏等比缩放：stage 固定 1920x1080，按视口缩放居中 */
export function useScreenScale() {
  const scale = ref(1)
  const offsetX = ref(0)
  const offsetY = ref(0)

  const update = () => {
    const r = computeScale(window.innerWidth, window.innerHeight)
    scale.value = r.scale
    offsetX.value = r.offsetX
    offsetY.value = r.offsetY
  }

  onMounted(() => {
    update()
    window.addEventListener('resize', update)
  })
  onBeforeUnmount(() => window.removeEventListener('resize', update))

  return { scale, offsetX, offsetY }
}
