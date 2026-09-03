import type { Period } from './types'

/** 累计统计的固定起始时间（需求文档：2024年1月1日） */
export const TOTAL_PERIOD_START = '2024-01-01T00:00:00'

export interface PeriodRange {
  start: Date
  end: Date
}

/**
 * 将排行榜时间范围（今日/本周/本月/本年/累计）解析为 [start, end]。
 * 本周以周一开始；累计从 2024-01-01 起。
 */
export function resolvePeriodRange(period: Period, now: Date = new Date()): PeriodRange {
  const end = now
  const start = new Date(now)
  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0)
      break
    case 'week': {
      start.setHours(0, 0, 0, 0)
      const day = start.getDay() // 0=周日
      const diff = day === 0 ? 6 : day - 1
      start.setDate(start.getDate() - diff)
      break
    }
    case 'month':
      start.setHours(0, 0, 0, 0)
      start.setDate(1)
      break
    case 'year':
      start.setHours(0, 0, 0, 0)
      start.setMonth(0, 1)
      break
    case 'total':
      return { start: new Date(TOTAL_PERIOD_START), end }
  }
  return { start, end }
}

export const PERIOD_LABELS: Record<Period, string> = {
  today: '今日',
  week: '本周',
  month: '本月',
  year: '本年',
  total: '累计',
}
