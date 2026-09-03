import { onBeforeUnmount, onMounted, ref } from 'vue'

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export interface ClockText {
  time: string
  date: string
  weekday: string
}

/** 把时间格式化为顶栏展示文本（纯函数，可测） */
export function formatClock(d: Date): ClockText {
  return {
    time: pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()),
    date: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
    weekday: WEEKDAYS[d.getDay()],
  }
}

/** 每秒更新的实时时钟 */
export function useClock() {
  const clock = ref<ClockText>(formatClock(new Date()))
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    timer = setInterval(() => {
      clock.value = formatClock(new Date())
    }, 1000)
  })
  onBeforeUnmount(() => clearInterval(timer))
  return { clock }
}
