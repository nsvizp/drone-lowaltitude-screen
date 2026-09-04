import { describe, expect, it } from 'vitest'
import { attemptsLeft, lockRemainSec, LOCK_DURATION_MS } from './login-lock'

const T = 1_000_000

describe('服务端登录锁定（滑动窗口）', () => {
  it('4 次失败不锁，第 5 次锁定 5 分钟', () => {
    const four = [T, T + 1000, T + 2000, T + 3000]
    expect(lockRemainSec({ failures: four, now: T + 4000 })).toBe(0)
    const five = [...four, T + 4000]
    expect(lockRemainSec({ failures: five, now: T + 4000 })).toBe(LOCK_DURATION_MS / 1000)
  })

  it('倒计时随时间递减', () => {
    const five = [T, T + 1, T + 2, T + 3, T + 4]
    expect(lockRemainSec({ failures: five, now: T + 60_004 })).toBe(240)
  })

  it('窗口外的旧失败不计入', () => {
    // 5 次失败都在 6 分钟前 → 已出窗口，不锁
    const old = [T, T + 1, T + 2, T + 3, T + 4]
    expect(lockRemainSec({ failures: old, now: T + 6 * 60_000 })).toBe(0)
  })

  it('attemptsLeft 返回剩余尝试次数', () => {
    expect(attemptsLeft({ failures: [], now: T })).toBe(5)
    expect(attemptsLeft({ failures: [T - 1000, T - 500], now: T })).toBe(3)
    expect(attemptsLeft({ failures: [T, T, T, T, T], now: T })).toBe(0)
  })
})
